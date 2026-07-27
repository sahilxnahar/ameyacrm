import { describe, it, expect } from 'vitest';
import { classifyDemandKind, isInDemandScope, addDays, endOfDay } from '@/lib/finance/demand-window';

const NOW = new Date('2026-07-21T10:00:00Z');

describe('payment dunning window (module #4)', () => {
  it('classifies a past due date as OVERDUE and a future one as UPCOMING', () => {
    expect(classifyDemandKind(new Date('2026-07-20T10:00:00Z'), NOW)).toBe('OVERDUE');
    expect(classifyDemandKind(new Date('2026-07-25T10:00:00Z'), NOW)).toBe('UPCOMING');
  });

  it('pulls overdue and near-due milestones into scope, but not far-future ones', () => {
    expect(isInDemandScope(new Date('2026-06-01T00:00:00Z'), NOW)).toBe(true);  // long overdue
    expect(isInDemandScope(addDays(NOW, 3), NOW)).toBe(true);                    // due in 3 days
    expect(isInDemandScope(addDays(NOW, 7), NOW)).toBe(true);                    // due on the window edge
    expect(isInDemandScope(addDays(NOW, 20), NOW)).toBe(false);                  // beyond the window
  });

  it('respects a custom window and includes the whole due day', () => {
    expect(isInDemandScope(addDays(NOW, 14), NOW, 14)).toBe(true);
    // a due date late on the last window day is still in scope (endOfDay)
    const edge = endOfDay(addDays(NOW, 7));
    expect(isInDemandScope(edge, NOW)).toBe(true);
  });
});
