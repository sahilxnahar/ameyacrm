/**
 * Pure unread-tally used by the conversation list (chat-service).
 *
 * Extracted so the H1 "one query instead of a COUNT per conversation" fix has a
 * unit test: given every message someone else sent and each conversation's
 * last-read time, count — per conversation — the messages newer than that time.
 */
export interface UnreadCandidate { conversationId: string; createdAt: Date }

export function tallyUnread(
  candidates: UnreadCandidate[],
  lastReadByConv: Map<string, Date | null>,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const msg of candidates) {
    const lastRead = lastReadByConv.get(msg.conversationId);
    if (!lastRead || msg.createdAt > lastRead) {
      out.set(msg.conversationId, (out.get(msg.conversationId) ?? 0) + 1);
    }
  }
  return out;
}
