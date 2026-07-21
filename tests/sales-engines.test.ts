import { describe, it, expect } from 'vitest';
import { priceUnit, discountApproval, type ApprovalTier } from '@/lib/sales/pricing';
import { delayInterest, daysLate } from '@/lib/sales/interest';
import { computeCommission, rateForValue } from '@/lib/sales/commission';

describe('priceUnit', () => {
  it('builds gross from base + floor rise + PLC + view + lump sums', () => {
    const r = priceUnit({
      areaSqft: 1000, baseRatePerSqft: 6000,
      floor: 5, baseFloor: 0, floorRisePerSqft: 50, // 5 floors × 50 = 250/sqft
      plcPerSqft: 100, viewPremiumPerSqft: 75, lumpSums: [300000],
    });
    expect(r.baseAmount).toBe(6_000_000);
    expect(r.floorRiseAmount).toBe(250_000);
    expect(r.plcAmount).toBe(100_000);
    expect(r.viewPremiumAmount).toBe(75_000);
    expect(r.lumpSumTotal).toBe(300_000);
    expect(r.grossPrice).toBe(6_725_000);
    expect(r.netPrice).toBe(6_725_000); // no discount
  });

  it('applies a discount, caps it at gross, and computes the percentage', () => {
    const r = priceUnit({ areaSqft: 1000, baseRatePerSqft: 5000, floor: 0, discountAmount: 250000 });
    expect(r.grossPrice).toBe(5_000_000);
    expect(r.netPrice).toBe(4_750_000);
    expect(r.discountPct).toBe(5);
    expect(r.effectiveRatePerSqft).toBe(4750);
  });

  it('never charges floor rise below the base floor', () => {
    const r = priceUnit({ areaSqft: 1000, baseRatePerSqft: 5000, floor: 0, baseFloor: 3, floorRisePerSqft: 50 });
    expect(r.floorRiseAmount).toBe(0);
  });
});

describe('discountApproval', () => {
  const matrix: ApprovalTier[] = [
    { role: 'EXECUTIVE', maxDiscountPct: 2 },
    { role: 'MANAGER', maxDiscountPct: 5 },
    { role: 'DIRECTOR', maxDiscountPct: 12 },
  ];
  it('passes a discount within the role limit', () => {
    expect(discountApproval(1.5, 'EXECUTIVE', matrix).withinLimit).toBe(true);
  });
  it('routes an over-limit discount to the lowest role that can approve it', () => {
    const r = discountApproval(4, 'EXECUTIVE', matrix);
    expect(r.withinLimit).toBe(false);
    expect(r.approverNeeded).toBe('MANAGER');
  });
  it('returns no approver when the discount exceeds every tier', () => {
    expect(discountApproval(20, 'MANAGER', matrix).approverNeeded).toBeNull();
  });
});

describe('delayInterest', () => {
  const d = (s: string) => new Date(s + 'T00:00:00Z');
  it('counts days late from the due date', () => {
    expect(daysLate(d('2026-07-01'), d('2026-07-21'))).toBe(20);
    expect(daysLate(d('2026-07-21'), d('2026-07-01'))).toBe(0); // paid early → 0
  });
  it('charges simple interest beyond the grace period', () => {
    const r = delayInterest({ amount: 1_000_000, dueDate: d('2026-06-01'), asOf: d('2026-07-01'), annualRatePct: 18, graceDays: 7 });
    expect(r.daysLate).toBe(30);
    expect(r.chargeableDays).toBe(23);
    // 1,000,000 × 18% × 23/365 ≈ 11,342
    expect(r.interest).toBe(Math.round(1_000_000 * 0.18 * 23 / 365));
  });
  it('is zero when paid within grace', () => {
    const r = delayInterest({ amount: 500000, dueDate: d('2026-07-01'), asOf: d('2026-07-05'), annualRatePct: 18, graceDays: 7 });
    expect(r.interest).toBe(0);
  });
});

describe('computeCommission', () => {
  const slabs = [{ fromValue: 0, ratePct: 1 }, { fromValue: 5_000_000, ratePct: 2 }, { fromValue: 10_000_000, ratePct: 2.5 }];
  it('picks the right slab rate', () => {
    expect(rateForValue(3_000_000, slabs)).toBe(1);
    expect(rateForValue(7_000_000, slabs)).toBe(2);
    expect(rateForValue(12_000_000, slabs)).toBe(2.5);
  });
  it('computes gross, TDS and net across milestones', () => {
    const r = computeCommission({ bookingValue: 10_000_000, slabs, tdsRatePct: 5, milestonesPct: [50, 50] });
    expect(r.ratePct).toBe(2.5);
    expect(r.grossCommission).toBe(250_000); // 2.5% of 1cr
    expect(r.totalTds).toBe(12_500); // 5%
    expect(r.netPayable).toBe(237_500);
    expect(r.milestones).toHaveLength(2);
    expect(r.milestones[0]!.gross).toBe(125_000);
  });
  it('defaults to a single full milestone', () => {
    const r = computeCommission({ bookingValue: 6_000_000, slabs });
    expect(r.milestones).toHaveLength(1);
    expect(r.grossCommission).toBe(120_000); // 2% of 60L
  });
});
