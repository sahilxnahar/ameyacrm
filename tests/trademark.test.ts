import { describe, it, expect } from 'vitest';
import { renewalDueDate, isRenewalApproaching, renewalLabel, TM_TERM_YEARS } from '@/lib/legal/trademark';

describe('trademark renewal logic (module #81)', () => {
  it('computes renewal 10 years after registration', () => {
    const reg = new Date('2020-04-15T00:00:00Z');
    const due = renewalDueDate(reg);
    expect(due.getUTCFullYear()).toBe(2020 + TM_TERM_YEARS);
    expect(due.getUTCMonth()).toBe(reg.getUTCMonth());
    expect(due.getUTCDate()).toBe(reg.getUTCDate());
  });

  it('flags a renewal within the alert window and one already overdue', () => {
    const now = new Date('2026-07-21T00:00:00Z');
    expect(isRenewalApproaching(new Date('2026-09-01T00:00:00Z'), now, 180)).toBe(true);  // ~6 weeks out
    expect(isRenewalApproaching(new Date('2025-01-01T00:00:00Z'), now, 180)).toBe(true);  // overdue
    expect(isRenewalApproaching(new Date('2027-06-01T00:00:00Z'), now, 180)).toBe(false); // >6mo out
  });

  it('labels the distance to renewal', () => {
    const now = new Date('2026-07-21T00:00:00Z');
    expect(renewalLabel(new Date('2026-07-21T00:00:00Z'), now)).toBe('due today');
    expect(renewalLabel(new Date('2026-07-11T00:00:00Z'), now)).toMatch(/overdue by \d+d/);
    expect(renewalLabel(new Date('2026-08-10T00:00:00Z'), now)).toMatch(/due in \d+d/);
    expect(renewalLabel(new Date('2027-07-21T00:00:00Z'), now)).toMatch(/due in \d+mo/);
  });
});
