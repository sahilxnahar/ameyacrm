'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { getActionContext, toActionError } from './_helpers';
import { parseMentions } from '@/lib/chat/mentions';
import { notifyUsers } from '@/lib/notify/notify';
import { fireAndForget } from '@/lib/resilience/safely';
import { isMember, getMessages, type ChatMessageRow } from '@/server/services/chat-service';
import { checkRate } from '@/lib/security/rate-limit';
import { publish } from '@/lib/realtime/realtime';

export type ChatResult = { ok: true; conversationId?: string } | { error: string };

/** Fetch a conversation's messages — used to poll for new ones while it's open. */
export async function fetchMessages(conversationId: string): Promise<{ ok: true; messages: ChatMessageRow[] } | { error: string }> {
  try {
    const ctx = await getActionContext();
    if (!(await isMember(conversationId, ctx.user.id))) return { error: 'Not allowed.' };
    return { ok: true, messages: await getMessages(conversationId, ctx.user.id) };
  } catch (e) { return toActionError(e); }
}

/** Open (or reuse) a one-to-one conversation with another person. */
export async function startDirectConversation(otherUserId: string): Promise<ChatResult> {
  try {
    const ctx = await getActionContext();
    const me = ctx.user.id;
    if (!otherUserId || otherUserId === me) return { error: 'Pick someone else to message.' };
    const other = await prisma.user.findUnique({ where: { id: otherUserId }, select: { id: true } });
    if (!other) return { error: 'That person no longer exists.' };

    const mine = await prisma.conversationMember.findMany({ where: { userId: me }, select: { conversationId: true } });
    const ids = mine.map((m) => m.conversationId);
    const existing = ids.length
      ? await prisma.conversation.findFirst({
          where: { id: { in: ids }, isGroup: false, members: { some: { userId: otherUserId } } },
          include: { _count: { select: { members: true } } },
        })
      : null;
    if (existing && existing._count.members === 2) return { ok: true, conversationId: existing.id };

    const created = await prisma.conversation.create({
      data: { isGroup: false, members: { create: [{ userId: me }, { userId: otherUserId }] } },
      select: { id: true },
    });
    return { ok: true, conversationId: created.id };
  } catch (e) { return toActionError(e); }
}

export interface OutgoingAttachment { url: string; name: string; mimeType?: string | null }

/** Send a message, optionally with attachments (e.g. a screenshot of a forwarded
 * email). Anyone @mentioned is notified. Membership is checked server-side. */
export async function sendMessage(conversationId: string, body: string, attachments: OutgoingAttachment[] = []): Promise<ChatResult> {
  try {
    const ctx = await getActionContext();
    const me = ctx.user.id;
    // Guard against a runaway client or a spam loop — 40 sends per 10s per person
    // is far above human typing speed.
    const rate = await checkRate(`chat-send:${me}`, 40, 10);
    if (!rate.allowed) return { error: 'You’re sending messages too quickly — give it a second.' };
    const text = (body ?? '').trim().slice(0, 4000);
    const files = (attachments ?? []).filter((a) => a && typeof a.url === 'string' && a.url.startsWith('http')).slice(0, 10);
    if (!text && files.length === 0) return { error: 'Type a message or attach something.' };
    if (!(await isMember(conversationId, me))) return { error: 'You are not part of this conversation.' };

    await prisma.chatMessage.create({
      data: {
        conversationId, senderId: me, body: text,
        attachments: files.length ? { create: files.map((f) => ({ url: f.url, name: f.name.slice(0, 200), mimeType: f.mimeType ?? null })) } : undefined,
      },
    });
    await prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
    await prisma.conversationMember.update({ where: { conversationId_userId: { conversationId, userId: me } }, data: { lastReadAt: new Date() } });

    // Nudge anyone watching this conversation to refresh instantly (if a realtime
    // service is configured; otherwise this is a no-op and polling covers it).
    fireAndForget(() => publish(`conversation:${conversationId}`, 'message', {}), 'realtime chat message');

    // Notify anyone tagged with @username who is a real, active person.
    const handles = new Set(parseMentions(text));
    if (handles.size > 0) {
      const all = await prisma.user.findMany({ where: { status: 'ACTIVE' }, select: { id: true, username: true } });
      const mentioned = all.filter((u) => handles.has((u.username ?? '').toLowerCase()) && u.id !== me).map((u) => u.id);
      if (mentioned.length) {
        fireAndForget(
          () => notifyUsers(mentioned, { type: 'MENTION', title: `${ctx.user.name} mentioned you`, body: text.slice(0, 140), link: `/chat?c=${conversationId}` }),
          'chat mention notify',
        );
      }
    }

    revalidatePath('/chat');
    return { ok: true, conversationId };
  } catch (e) { return toActionError(e); }
}

export async function markConversationRead(conversationId: string): Promise<ChatResult> {
  try {
    const ctx = await getActionContext();
    if (!(await isMember(conversationId, ctx.user.id))) return { ok: true };
    await prisma.conversationMember.update({ where: { conversationId_userId: { conversationId, userId: ctx.user.id } }, data: { lastReadAt: new Date() } });
    return { ok: true };
  } catch (e) { return toActionError(e); }
}

/** Set your own @username — the handle people tag you by. */
export async function setMyUsername(username: string): Promise<ChatResult> {
  try {
    const ctx = await getActionContext();
    const handle = z.string().trim().regex(/^[a-zA-Z0-9._-]{2,32}$/, 'Use 2–32 letters, numbers, dot, dash or underscore.').parse(username);
    const clash = await prisma.user.findFirst({ where: { username: { equals: handle, mode: 'insensitive' }, id: { not: ctx.user.id } }, select: { id: true } });
    if (clash) return { error: 'That username is already taken.' };
    await prisma.user.update({ where: { id: ctx.user.id }, data: { username: handle } });
    revalidatePath('/chat');
    return { ok: true };
  } catch (e) { return toActionError(e); }
}
