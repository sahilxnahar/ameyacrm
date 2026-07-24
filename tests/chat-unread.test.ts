import { describe, it, expect } from 'vitest';
import { tallyUnread, type UnreadCandidate } from '@/lib/chat/unread';

const d = (iso: string) => new Date(iso);

describe('chat unread tally (H1 N+1 fix)', () => {
  it('counts only messages newer than the conversation last-read time', () => {
    const candidates: UnreadCandidate[] = [
      { conversationId: 'a', createdAt: d('2026-01-01T10:00:00Z') }, // before read
      { conversationId: 'a', createdAt: d('2026-01-01T12:00:00Z') }, // after read
      { conversationId: 'a', createdAt: d('2026-01-01T13:00:00Z') }, // after read
    ];
    const lastRead = new Map<string, Date | null>([['a', d('2026-01-01T11:00:00Z')]]);
    expect(tallyUnread(candidates, lastRead).get('a')).toBe(2);
  });

  it('counts everything when a conversation was never read (null)', () => {
    const candidates: UnreadCandidate[] = [
      { conversationId: 'b', createdAt: d('2026-01-01T10:00:00Z') },
      { conversationId: 'b', createdAt: d('2026-01-01T11:00:00Z') },
    ];
    expect(tallyUnread(candidates, new Map([['b', null]])).get('b')).toBe(2);
  });

  it('counts everything when there is no membership entry', () => {
    const candidates: UnreadCandidate[] = [{ conversationId: 'c', createdAt: d('2026-01-01T10:00:00Z') }];
    expect(tallyUnread(candidates, new Map()).get('c')).toBe(1);
  });

  it('tallies each conversation independently', () => {
    const candidates: UnreadCandidate[] = [
      { conversationId: 'a', createdAt: d('2026-01-02T00:00:00Z') },
      { conversationId: 'b', createdAt: d('2026-01-02T00:00:00Z') },
      { conversationId: 'b', createdAt: d('2026-01-02T01:00:00Z') },
    ];
    const out = tallyUnread(candidates, new Map<string, Date | null>([['a', null], ['b', null]]));
    expect(out.get('a')).toBe(1);
    expect(out.get('b')).toBe(2);
  });

  it('returns an empty map for no candidates', () => {
    expect(tallyUnread([], new Map()).size).toBe(0);
  });
});
