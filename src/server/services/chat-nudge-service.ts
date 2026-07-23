import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { env } from '@/config/env';
import { sendEmail } from '@/lib/email/email';

/**
 * "You have a message waiting" emails.
 *
 * The private chat is only useful if people notice it. Two ways in:
 *   1. A manual nudge — the sender presses a button and the other person gets an
 *      email straight away ("… messaged you on the secure platform").
 *   2. An automatic sweep — anyone who has left a message unread for a few hours
 *      gets one email about it, so a message never sits unseen for days.
 *
 * The "already emailed" state lives in the Setting key/value table (one row per
 * conversation+person), so this needs no schema change. We only ever email once
 * per unread message: the stored timestamp is compared against the message time.
 */
const appUrl = () => env.APP_URL.replace(/\/$/, '');

/** How long a message may sit unread before the automatic sweep emails about it. */
const STALE_HOURS = 3;

const nudgeKey = (conversationId: string, userId: string) => `chatnudge:${conversationId}:${userId}`;

async function setNudged(conversationId: string, userId: string, at: Date): Promise<void> {
  const key = nudgeKey(conversationId, userId);
  await prisma.setting.upsert({
    where: { key },
    update: { value: at.toISOString() },
    create: { key, value: at.toISOString() },
  }).catch(() => undefined);
}

function buildEmail(toName: string, fromName: string, conversationId: string, preview: string | null) {
  const link = `${appUrl()}/chat?c=${conversationId}`;
  const line = `${fromName} has messaged you on the Ameya Heights secure chat. Please look into it.`;
  const text = [
    `Hello ${toName},`,
    '',
    line,
    preview ? `\n"${preview}"\n` : '',
    `Open the conversation: ${link}`,
    '',
    'This is a private message inside the CRM — reply there, not to this email.',
    '',
    '— Ameya Heights CRM',
  ].filter((l) => l !== '').join('\n');
  const html =
    `<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:auto;color:#16140f">` +
    `<p>Hello ${escapeHtml(toName)},</p>` +
    `<p>${escapeHtml(line)}</p>` +
    (preview ? `<blockquote style="margin:12px 0;padding:8px 12px;border-left:3px solid #A07D34;background:#f6f3ec;color:#45423a">${escapeHtml(preview)}</blockquote>` : '') +
    `<p style="margin:20px 0"><a href="${link}" style="background:#1B2A4A;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">Open the conversation</a></p>` +
    `<p style="font-size:12px;color:#8a8579">This is a private message inside the CRM — reply there, not to this email.</p>` +
    `<p style="font-size:12px;color:#8a8579">— Ameya Heights CRM</p>` +
    `</div>`;
  return { subject: `${fromName} messaged you on the Ameya Heights secure chat`, text, html };
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

/**
 * Manual nudge — email every other member of a conversation right now. Returns
 * how many emails actually went out (0 if the other people have no email set).
 */
export async function emailNudgeNow(conversationId: string, fromUserId: string): Promise<{ sent: number; error?: string }> {
  const from = await prisma.user.findUnique({ where: { id: fromUserId }, select: { name: true } });
  const members = await prisma.conversationMember.findMany({ where: { conversationId, userId: { not: fromUserId } }, select: { userId: true } });
  const ids = members.map((m) => m.userId);
  if (!ids.length) return { sent: 0 };
  const users = await prisma.user.findMany({ where: { id: { in: ids }, status: 'ACTIVE' }, select: { id: true, name: true, email: true } });
  const last = await prisma.chatMessage.findFirst({ where: { conversationId, senderId: fromUserId }, orderBy: { createdAt: 'desc' }, select: { body: true } });
  const preview = (last?.body ?? '').trim().slice(0, 140) || null;

  let sent = 0;
  for (const u of users) {
    if (!u.email) continue;
    const mail = buildEmail(u.name, from?.name ?? 'Someone', conversationId, preview);
    const r = await sendEmail({ to: [u.email], subject: mail.subject, text: mail.text, html: mail.html });
    if (r.ok) { sent++; await setNudged(conversationId, u.id, new Date()); }
  }
  return { sent };
}

/**
 * Automatic sweep — email anyone who has an unread message older than
 * STALE_HOURS, once per message. Called from the daily (and hourly, if wired)
 * cron. Idempotent: safe to run as often as you like.
 */
export async function runChatNudges(now = new Date()): Promise<{ checked: number; emailed: number }> {
  const cutoff = new Date(now.getTime() - STALE_HOURS * 36e5);
  const weekAgo = new Date(now.getTime() - 7 * 864e5);

  const convs = await prisma.conversation.findMany({
    where: { updatedAt: { gte: weekAgo } },
    select: {
      id: true,
      members: { select: { userId: true, lastReadAt: true } },
      messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { senderId: true, createdAt: true, body: true } },
    },
    take: 300,
  });

  const candidates: { convId: string; userId: string; senderId: string; msgAt: Date; preview: string | null }[] = [];
  for (const c of convs) {
    const last = c.messages[0];
    if (!last || !last.senderId) continue;
    if (last.createdAt > cutoff) continue; // give them time to reply before nagging
    for (const m of c.members) {
      if (m.userId === last.senderId) continue; // don't email the sender
      if (m.lastReadAt && m.lastReadAt >= last.createdAt) continue; // already read
      candidates.push({ convId: c.id, userId: m.userId, senderId: last.senderId, msgAt: last.createdAt, preview: (last.body ?? '').trim().slice(0, 140) || null });
    }
  }
  if (!candidates.length) return { checked: 0, emailed: 0 };

  const userIds = [...new Set([...candidates.map((c) => c.userId), ...candidates.map((c) => c.senderId)])];
  const users = new Map((await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true, status: true } })).map((u) => [u.id, u]));
  const settings = new Map(
    (await prisma.setting.findMany({ where: { key: { in: candidates.map((c) => nudgeKey(c.convId, c.userId)) } }, select: { key: true, value: true } }))
      .map((s) => [s.key, s.value]),
  );

  let emailed = 0;
  for (const cand of candidates) {
    const already = settings.get(nudgeKey(cand.convId, cand.userId));
    if (already && new Date(String(already)) >= cand.msgAt) continue; // already emailed for this message
    const to = users.get(cand.userId);
    if (!to?.email || to.status !== 'ACTIVE') continue;
    const from = users.get(cand.senderId);
    const mail = buildEmail(to.name, from?.name ?? 'Someone', cand.convId, cand.preview);
    const r = await sendEmail({ to: [to.email], subject: mail.subject, text: mail.text, html: mail.html });
    if (r.ok) { emailed++; await setNudged(cand.convId, cand.userId, now); }
  }
  return { checked: candidates.length, emailed };
}
