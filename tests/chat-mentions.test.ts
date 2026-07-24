import { describe, it, expect } from 'vitest';
import { parseMentions, segmentMessage } from '@/lib/chat/mentions';

describe('chat @mentions', () => {
  it('pulls handles out of a message', () => {
    expect(parseMentions('hey @ravi and @Priya_1, check this').sort()).toEqual(['priya_1', 'ravi']);
  });
  it('does not treat an email as a mention', () => {
    expect(parseMentions('mail me at ravi@bizdateup.com')).toEqual([]);
  });
  it('dedupes repeated handles', () => {
    expect(parseMentions('@ravi @ravi @ravi')).toEqual(['ravi']);
  });
  it('segments text and mentions in order', () => {
    const segs = segmentMessage('hi @ravi ok');
    expect(segs).toEqual([
      { type: 'text', value: 'hi ' },
      { type: 'mention', handle: 'ravi' },
      { type: 'text', value: ' ok' },
    ]);
  });
  it('handles a mention at the start', () => {
    expect(segmentMessage('@ravi hello')).toEqual([
      { type: 'mention', handle: 'ravi' },
      { type: 'text', value: ' hello' },
    ]);
  });
});
