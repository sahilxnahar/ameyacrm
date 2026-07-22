import 'server-only';
import { prisma } from '@/lib/db/prisma';

export interface DirectoryUser { id: string; name: string; username: string; avatarUrl: string | null }
export interface ConversationSummary {
  id: string;
  title: string;
  otherUserId: string | null;
  lastMessage: string | null;
  lastAt: Date | null;
  unread: number;
}
export interface ChatAttachmentRow { id: string; url: string; name: string; mimeType: string | null }
export interface ChatMessageRow { id: string; senderId: string | null; senderName: string; body: string; createdAt: Date; mine: boolean; attachments: ChatAttachmentRow[] }

/** Everyone you can message — active users with a username, minus yourself. */
export async function userDirectory(excludeUserId: string): Promise<DirectoryUser[]> {
  const users = await prisma.user.findMany({
    where: { status: 'ACTIVE', id: { not: excludeUserId } },
    select: { id: true, name: true, username: true, avatarUrl: true },
    orderBy: { name: 'asc' },
    take: 500,
  });
  return users;
}

/** Your conversations, most-recent first, each showing the other person and unread count. */
export async function listConversations(userId: string): Promise<ConversationSummary[]> {
  const memberships = await prisma.conversationMember.findMany({
    where: { userId },
    include: {
      conversation: {
        include: {
          members: { select: { userId: true } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      },
    },
    take: 300,
  });

  const convIds = memberships.map((m) => m.conversation.id);

  const otherIds = [...new Set(memberships.flatMap((m) => m.conversation.members.map((x) => x.userId)).filter((id) => id !== userId))];
  const names = otherIds.length
    ? new Map((await prisma.user.findMany({ where: { id: { in: otherIds } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]))
    : new Map<string, string>();

  // Unread counts in ONE query, not a COUNT per conversation (the old N+1). We
  // pull just the (conversation, time) of every message someone else sent, then
  // tally per conversation against that person's own last-read time in memory.
  const unreadCandidates = convIds.length
    ? await prisma.chatMessage.findMany({
        where: { conversationId: { in: convIds }, senderId: { not: userId } },
        select: { conversationId: true, createdAt: true },
        take: 5000,
      })
    : [];
  const lastReadByConv = new Map(memberships.map((m) => [m.conversation.id, m.lastReadAt] as const));
  const unreadByConv = new Map<string, number>();
  for (const msg of unreadCandidates) {
    const lastRead = lastReadByConv.get(msg.conversationId);
    if (!lastRead || msg.createdAt > lastRead) {
      unreadByConv.set(msg.conversationId, (unreadByConv.get(msg.conversationId) ?? 0) + 1);
    }
  }

  const rows = memberships.map((m) => {
    const c = m.conversation;
    const others = c.members.map((x) => x.userId).filter((id) => id !== userId);
    const otherUserId = others[0] ?? null;
    const last = c.messages[0] ?? null;
    return {
      id: c.id,
      title: c.title ?? (otherUserId ? names.get(otherUserId) ?? 'Direct message' : 'Conversation'),
      otherUserId,
      lastMessage: last?.body ?? null,
      lastAt: last?.createdAt ?? c.updatedAt,
      unread: unreadByConv.get(c.id) ?? 0,
    };
  });
  return rows.sort((a, b) => (b.lastAt?.getTime() ?? 0) - (a.lastAt?.getTime() ?? 0));
}

/** Is this person a member of the conversation? Access is checked here, server-side. */
export async function isMember(conversationId: string, userId: string): Promise<boolean> {
  const m = await prisma.conversationMember.findUnique({ where: { conversationId_userId: { conversationId, userId } }, select: { id: true } });
  return Boolean(m);
}

/** The messages of a conversation (membership must already be checked). */
export async function getMessages(conversationId: string, userId: string): Promise<ChatMessageRow[]> {
  const messages = await prisma.chatMessage.findMany({ where: { conversationId }, orderBy: { createdAt: 'asc' }, take: 500, include: { attachments: true } });
  const senderIds = [...new Set(messages.map((m) => m.senderId).filter((x): x is string => Boolean(x)))];
  const names = senderIds.length
    ? new Map((await prisma.user.findMany({ where: { id: { in: senderIds } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]))
    : new Map<string, string>();
  return messages.map((m) => ({
    id: m.id,
    senderId: m.senderId,
    senderName: m.senderId ? names.get(m.senderId) ?? 'Someone' : 'Someone',
    body: m.body,
    createdAt: m.createdAt,
    mine: m.senderId === userId,
    attachments: m.attachments.map((a) => ({ id: a.id, url: a.url, name: a.name, mimeType: a.mimeType })),
  }));
}
