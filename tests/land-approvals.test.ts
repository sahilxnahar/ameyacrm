import { describe, it, expect } from 'vitest';
import { daysBetween, sanctionHealth, summariseSanctions, isOpen, type SanctionInput } from '@/lib/land/approvals';

const NOW = new Date('2026-07-21T09:00:00Z');
const d = (s: string) => new Date(s + 'T00:00:00Z');

const s = (o: Partial<SanctionInput> & { id: string }): SanctionInput => ({
  id: o.id,
  authority: o.authority ?? 'BBMP',
  name: o.name ?? 'Plan sanction',
  status: o.status ?? 'APPLIED',
  expectedOn: o.expectedOn ?? null,
  expiresOn: o.expiresOn ?? null,
  approvedOn: o.approvedOn ?? null,
});

describe('daysBetween', () => {
  it('is zero for the same calendar day regardless of the time of day', () => {
    expect(daysBetween(new Date('2026-07-21T23:30:00Z'), d('2026-07-21'))).toBe(0);
  });
  it('counts forward and backward in whole days', () => {
    expect(daysBetween(NOW, d('2026-07-31'))).toBe(10);
    expect(daysBetween(NOW, d('2026-07-11'))).toBe(-10);
  });
});

describe('sanctionHealth', () => {
  it('an open approval past its expected date is overdue', () => {
    const h = sanctionHealth(s({ id: 'a', status: 'IN_PROCESS', expectedOn: d('2026-07-01') }), NOW);
    expect(h.overdue).toBe(true);
    expect(h.daysOverdue).toBe(20);
  });

  it('an approved sanction is never counted as overdue even past the expected date', () => {
    const h = sanctionHealth(s({ id: 'a', status: 'APPROVED', expectedOn: d('2026-07-01') }), NOW);
    expect(h.overdue).toBe(false);
  });

  it('an approved sanction expiring within the window is flagged', () => {
    const h = sanctionHealth(s({ id: 'a', status: 'APPROVED', expiresOn: d('2026-08-10') }), NOW);
    expect(h.expiringSoon).toBe(true);
    expect(h.expired).toBe(false);
    expect(h.daysToExpiry).toBe(20);
  });

  it('a lapsed sanction is expired, not expiring', () => {
    const h = sanctionHealth(s({ id: 'a', status: 'APPROVED', expiresOn: d('2026-07-01') }), NOW);
    expect(h.expired).toBe(true);
    expect(h.expiringSoon).toBe(false);
  });

  it('does not flag expiry that is still far away', () => {
    const h = sanctionHealth(s({ id: 'a', status: 'APPROVED', expiresOn: d('2027-01-01') }), NOW);
    expect(h.expiringSoon).toBe(false);
    expect(h.expired).toBe(false);
  });
});

describe('isOpen', () => {
  it('treats pipeline statuses as open and terminal ones as closed', () => {
    expect(isOpen('APPLIED')).toBe(true);
    expect(isOpen('QUERY_RAISED')).toBe(true);
    expect(isOpen('APPROVED')).toBe(false);
    expect(isOpen('REJECTED')).toBe(false);
  });
});

describe('summariseSanctions', () => {
  it('rolls a list up into the dashboard counts', () => {
    const sum = summariseSanctions([
      s({ id: '1', status: 'APPROVED', expiresOn: d('2026-08-01') }), // expiring soon
      s({ id: '2', status: 'IN_PROCESS', expectedOn: d('2026-06-01') }), // overdue
      s({ id: '3', status: 'APPROVED', expiresOn: d('2026-06-01') }), // expired
      s({ id: '4', status: 'APPLIED', expectedOn: d('2026-12-01') }), // open, on time
    ], NOW);
    expect(sum.total).toBe(4);
    expect(sum.approved).toBe(2);
    expect(sum.open).toBe(2);
    expect(sum.overdue).toBe(1);
    expect(sum.expiringSoon).toBe(1);
    expect(sum.expired).toBe(1);
  });
});
