import { describe, it, expect, beforeEach } from 'vitest';
import { on, emit, _resetHandlers } from '@/lib/events/bus';

describe('event bus (I1)', () => {
  beforeEach(() => _resetHandlers());

  it('delivers an event to every subscriber', async () => {
    const seen: string[] = [];
    on('workrequest.raised', (e) => { seen.push(`a:${e.reference}`); });
    on('workrequest.raised', (e) => { seen.push(`b:${e.reference}`); });
    await emit({ type: 'workrequest.raised', requestId: '1', reference: 'WR-1', title: 'x', toDeptId: null });
    expect(seen.sort()).toEqual(['a:WR-1', 'b:WR-1']);
  });

  it('isolates a throwing handler — the others still run', async () => {
    const seen: string[] = [];
    on('workrequest.raised', () => { throw new Error('boom'); });
    on('workrequest.raised', () => { seen.push('ran'); });
    // emit must not reject even though a handler throws
    await expect(emit({ type: 'workrequest.raised', requestId: '1', reference: 'WR-1', title: 'x', toDeptId: null })).resolves.toBeUndefined();
    expect(seen).toEqual(['ran']);
  });

  it('only calls handlers for the matching type', async () => {
    let count = 0;
    on('workrequest.advanced', () => { count += 1; });
    await emit({ type: 'workrequest.raised', requestId: '1', reference: 'WR-1', title: 'x', toDeptId: null });
    expect(count).toBe(0);
  });

  it('unsubscribes cleanly', async () => {
    let count = 0;
    const off = on('workrequest.raised', () => { count += 1; });
    await emit({ type: 'workrequest.raised', requestId: '1', reference: 'WR-1', title: 'x', toDeptId: null });
    off();
    await emit({ type: 'workrequest.raised', requestId: '2', reference: 'WR-2', title: 'y', toDeptId: null });
    expect(count).toBe(1);
  });

  it('does nothing (and does not throw) when there are no subscribers', async () => {
    await expect(emit({ type: 'workrequest.advanced', requestId: '1', reference: 'WR-1', title: 'x', toStatus: 'ACCEPTED' })).resolves.toBeUndefined();
  });
});
