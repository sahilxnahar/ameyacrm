import { describe, it, expect } from 'vitest';
import { computeRaBill } from '@/lib/construction/ra-bill';

describe('RA bill computation (v15.53)', () => {
  it('deducts cess, retention and TDS from certified gross', () => {
    const c = computeRaBill({ grossValue: 1000000, cessPercent: 1, retentionPercent: 5, tdsSection: '194C', hasPan: true });
    expect(c.cessAmount).toBe(10000);       // 1% BOCW
    expect(c.retentionAmount).toBe(50000);  // 5%
    expect(c.tdsAmount).toBe(20000);        // 194C @ 2% (company) on 10L
    expect(c.netPayable).toBe(1000000 - 10000 - 50000 - 20000);
  });

  it('applies ad-hoc deductions', () => {
    const c = computeRaBill({ grossValue: 500000, deductions: 25000, cessPercent: 1, retentionPercent: 5, tdsSection: '194C' });
    expect(c.deductions).toBe(25000);
    expect(c.netPayable).toBe(500000 - 25000 - 5000 - 25000 - 10000);
  });

  it('uses the higher no-PAN TDS rate', () => {
    const c = computeRaBill({ grossValue: 1000000, tdsSection: '194C', hasPan: false });
    expect(c.tdsRate).toBe(20);
    expect(c.tdsAmount).toBe(200000);
  });

  it('never goes negative', () => {
    const c = computeRaBill({ grossValue: 1000, deductions: 999999, cessPercent: 1, retentionPercent: 5 });
    expect(c.netPayable).toBe(0);
  });
});
