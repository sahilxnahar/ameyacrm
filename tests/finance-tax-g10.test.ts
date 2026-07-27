import { describe, it, expect } from 'vitest';
import { computePocm } from '@/lib/finance/pocm';
import { computeCapitalGain } from '@/lib/tax/capital-gains';

describe('IND-AS 115 POCM (module #51)', () => {
  it('recognises revenue in proportion to cost incurred', () => {
    const r = computePocm({ costToDate: 40, totalEstCost: 100, totalContractVal: 200 });
    expect(r.pocmPercent).toBe(40);
    expect(r.revenueToDate).toBe(80);
  });
  it('never over-recognises past 100% even if cost overruns', () => {
    const r = computePocm({ costToDate: 150, totalEstCost: 100, totalContractVal: 200 });
    expect(r.pocmPercent).toBe(100);
    expect(r.revenueToDate).toBe(200);
  });
  it('computes only the incremental revenue for the period', () => {
    const r = computePocm({ costToDate: 60, totalEstCost: 100, totalContractVal: 200, revenueRecognisedSoFar: 80 });
    expect(r.revenueToDate).toBe(120);
    expect(r.revenueThisPeriod).toBe(40);
  });
  it('is safe when total estimated cost is zero', () => {
    expect(computePocm({ costToDate: 10, totalEstCost: 0, totalContractVal: 200 }).pocmPercent).toBe(0);
  });
});

describe('Capital gains S.54 / 54F (module #55)', () => {
  it('S.54 exempts the lesser of gain and amount reinvested', () => {
    const r = computeCapitalGain({ saleValue: 1_00_00_000, indexedCost: 40_00_000, section: '54', reinvestAmount: 50_00_000 });
    expect(r.gain).toBe(60_00_000);
    expect(r.exemptGain).toBe(50_00_000);
    expect(r.taxableGain).toBe(10_00_000);
    expect(r.taxSaved).toBe(10_00_000); // 50L exempt × 20%
  });
  it('S.54 fully exempts when reinvestment covers the whole gain', () => {
    const r = computeCapitalGain({ saleValue: 1_00_00_000, indexedCost: 40_00_000, section: '54', reinvestAmount: 60_00_000 });
    expect(r.exemptGain).toBe(60_00_000);
    expect(r.taxableGain).toBe(0);
  });
  it('S.54F exemption is proportionate to proceeds reinvested', () => {
    // reinvest half the sale value → exempt half the gain
    const r = computeCapitalGain({ saleValue: 1_00_00_000, indexedCost: 40_00_000, section: '54F', reinvestAmount: 50_00_000 });
    expect(r.exemptGain).toBe(30_00_000);
    expect(r.taxableGain).toBe(30_00_000);
  });
  it('never returns a negative gain', () => {
    const r = computeCapitalGain({ saleValue: 30_00_000, indexedCost: 40_00_000, section: '54', reinvestAmount: 0 });
    expect(r.gain).toBe(0);
    expect(r.taxableGain).toBe(0);
  });
});
