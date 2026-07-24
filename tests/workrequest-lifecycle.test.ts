import { describe, it, expect } from 'vitest';
import { nextStatuses, canTransition, isTerminal, wrActionLabel } from '@/lib/workrequests/lifecycle';

describe('work request lifecycle', () => {
  it('lets the receiver accept or reject a freshly raised request', () => {
    expect(nextStatuses('RAISED', 'receiver').sort()).toEqual(['ACCEPTED', 'REJECTED']);
  });

  it('lets the raiser only cancel a raised request', () => {
    expect(nextStatuses('RAISED', 'raiser')).toEqual(['REJECTED']);
  });

  it('walks the happy path receiver: accepted → in progress → done', () => {
    expect(canTransition('ACCEPTED', 'receiver', 'IN_PROGRESS')).toBe(true);
    expect(canTransition('IN_PROGRESS', 'receiver', 'DONE')).toBe(true);
  });

  it('only the raiser confirms a done request', () => {
    expect(canTransition('DONE', 'raiser', 'CONFIRMED')).toBe(true);
    expect(canTransition('DONE', 'receiver', 'CONFIRMED')).toBe(false);
  });

  it('lets the raiser send a done request back for more work', () => {
    expect(canTransition('DONE', 'raiser', 'SENT_BACK')).toBe(true);
    expect(canTransition('SENT_BACK', 'receiver', 'IN_PROGRESS')).toBe(true);
  });

  it('blocks illegal jumps', () => {
    expect(canTransition('RAISED', 'receiver', 'DONE')).toBe(false);
    expect(canTransition('CONFIRMED', 'receiver', 'IN_PROGRESS')).toBe(false);
  });

  it('marks confirmed and rejected as terminal', () => {
    expect(isTerminal('CONFIRMED')).toBe(true);
    expect(isTerminal('REJECTED')).toBe(true);
    expect(isTerminal('IN_PROGRESS')).toBe(false);
  });

  it('gives friendly action labels', () => {
    expect(wrActionLabel('IN_PROGRESS')).toBe('Start work');
    expect(wrActionLabel('CONFIRMED')).toBe('Confirm done');
  });
});
