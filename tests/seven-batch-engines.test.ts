import { describe, it, expect } from 'vitest';
import { appraise, residualLandValue } from '@/lib/feasibility/appraisal';
import { threeWayMatch } from '@/lib/procurement/three-way';
import { riskScore } from '@/lib/governance/risk';

describe('appraise (feasibility)', () => {
  it('computes total cost, sale value, profit and profit-on-cost', () => {
    const r = appraise({ landCost: 20_000_000, constructionCost: 50_000_000, financeCost: 8_000_000, otherCost: 2_000_000, saleableAreaSqft: 20000, salePricePerSqft: 6000 });
    expect(r.totalCost).toBe(80_000_000);
    expect(r.saleValue).toBe(120_000_000);
    expect(r.profit).toBe(40_000_000);
    expect(r.profitOnCostPct).toBe(50);
  });
  it('applies scenario knobs — sale down 5%, cost up 10%', () => {
    const r = appraise({ landCost: 0, constructionCost: 100, financeCost: 0, otherCost: 0, saleableAreaSqft: 1, salePricePerSqft: 200, salePriceDeltaPct: -5, costDeltaPct: 10 });
    expect(r.saleValue).toBe(190); // 200 × 0.95
    expect(r.totalCost).toBe(110); // 100 × 1.10
    expect(r.profit).toBe(80);
  });
  it('residual land value leaves the target return on non-land cost', () => {
    // sale 1000, non-land cost 600, target 20% → residual = 1000 - 600 - 120 = 280
    const rlv = residualLandValue({ constructionCost: 600, financeCost: 0, otherCost: 0, saleableAreaSqft: 1, salePricePerSqft: 1000 }, 20);
    expect(rlv).toBe(280);
  });
});

describe('threeWayMatch (procurement)', () => {
  it('is clean when ordered = received = billed', () => {
    const r = threeWayMatch(100, 100, 100);
    expect(r.clean).toBe(true);
    expect(r.status).toBe('MATCHED');
  });
  it('flags over-billing first', () => {
    const r = threeWayMatch(100, 90, 100); // received 90, billed 100
    expect(r.status).toBe('OVER_BILLED');
    expect(r.clean).toBe(false);
  });
  it('flags short receipt against the order', () => {
    const r = threeWayMatch(100, 80, 80);
    expect(r.status).toBe('SHORT_RECEIVED');
  });
  it('flags over-receipt', () => {
    expect(threeWayMatch(100, 110, 110).status).toBe('OVER_RECEIVED');
  });
});

describe('riskScore (governance)', () => {
  it('multiplies likelihood by impact and bands it', () => {
    expect(riskScore('CRITICAL', 'CRITICAL')).toEqual({ score: 16, band: 'SEVERE' });
    expect(riskScore('HIGH', 'MEDIUM')).toEqual({ score: 6, band: 'HIGH' });
    expect(riskScore('LOW', 'MEDIUM')).toEqual({ score: 2, band: 'LOW' });
    expect(riskScore('MEDIUM', 'MEDIUM')).toEqual({ score: 4, band: 'MODERATE' });
  });
});
