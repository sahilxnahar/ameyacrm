import { describe, it, expect } from 'vitest';
import { accrueFacilityInterest, summariseBorrowings } from '@/lib/treasury/borrowing-interest';

describe('accrueFacilityInterest', () => {
  it('accrues reducing-balance interest from the drawdown date', () => {
    // 10,00,000 drawn on Jan 1 at 12% p.a., measured one year later.
    const r = accrueFacilityInterest(
      [{ kind: 'DRAWDOWN', amount: 1_000_000, date: '2025-01-01' }],
      12,
      '2026-01-01',
    );
    expect(r.drawn).toBe(1_000_000);
    expect(r.outstanding).toBe(1_000_000);
    // 365 days * 1,000,000 * 0.12/365 = 120,000
    expect(r.interestAccrued).toBeCloseTo(120_000, 0);
    expect(r.netInterestDue).toBeCloseTo(120_000, 0);
  });

  it('drops the balance (and future interest) after a repayment', () => {
    const r = accrueFacilityInterest(
      [
        { kind: 'DRAWDOWN', amount: 1_000_000, date: '2025-01-01' },
        { kind: 'REPAYMENT', amount: 500_000, date: '2025-07-01' },
      ],
      12,
      '2026-01-01',
    );
    expect(r.outstanding).toBe(500_000);
    // ~181 days at 1,000,000 then ~184 days at 500,000 → well under a full-year 120k.
    expect(r.interestAccrued).toBeGreaterThan(80_000);
    expect(r.interestAccrued).toBeLessThan(100_000);
  });

  it('counts multiple drawdowns, each from its own date', () => {
    const r = accrueFacilityInterest(
      [
        { kind: 'DRAWDOWN', amount: 500_000, date: '2025-01-01' },
        { kind: 'DRAWDOWN', amount: 500_000, date: '2025-07-01' },
      ],
      12,
      '2026-01-01',
    );
    expect(r.drawn).toBe(1_000_000);
    expect(r.outstanding).toBe(1_000_000);
    // First tranche a full year (~60k), second only half (~30k) → ~90k.
    expect(r.interestAccrued).toBeGreaterThan(85_000);
    expect(r.interestAccrued).toBeLessThan(95_000);
  });

  it('subtracts interest already paid to get net interest due', () => {
    const r = accrueFacilityInterest(
      [
        { kind: 'DRAWDOWN', amount: 1_000_000, date: '2025-01-01' },
        { kind: 'INTEREST', amount: 50_000, date: '2025-06-01' },
      ],
      12,
      '2026-01-01',
    );
    expect(r.interestPaid).toBe(50_000);
    expect(r.netInterestDue).toBeCloseTo(70_000, 0);
  });

  it('is zero interest when no rate is set', () => {
    const r = accrueFacilityInterest([{ kind: 'DRAWDOWN', amount: 1_000_000, date: '2025-01-01' }], null, '2026-01-01');
    expect(r.interestAccrued).toBe(0);
    expect(r.outstanding).toBe(1_000_000);
  });

  it('ignores events dated after the as-of date', () => {
    const r = accrueFacilityInterest(
      [
        { kind: 'DRAWDOWN', amount: 1_000_000, date: '2025-01-01' },
        { kind: 'DRAWDOWN', amount: 9_000_000, date: '2027-01-01' },
      ],
      12,
      '2026-01-01',
    );
    expect(r.drawn).toBe(1_000_000);
  });
});

describe('summariseBorrowings', () => {
  it('totals balances and computes an interest-weighted average rate', () => {
    const s = summariseBorrowings([
      { outstanding: 1_000_000, interestAccrued: 120_000, interestPaid: 0, interestRate: 12 },
      { outstanding: 1_000_000, interestAccrued: 180_000, interestPaid: 0, interestRate: 18 },
    ]);
    expect(s.totalOutstanding).toBe(2_000_000);
    expect(s.totalNetInterestDue).toBe(300_000);
    expect(s.weightedAvgRate).toBeCloseTo(15, 1);
    // (1,000,000*0.12 + 1,000,000*0.18)/12 = 25,000 per month
    expect(s.monthlyInterestRunRate).toBeCloseTo(25_000, 0);
  });

  it('handles an empty portfolio', () => {
    const s = summariseBorrowings([]);
    expect(s.totalOutstanding).toBe(0);
    expect(s.weightedAvgRate).toBe(0);
  });
});
