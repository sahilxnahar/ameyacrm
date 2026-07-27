import { describe, it, expect } from 'vitest';
import { splitEscrow } from '@/lib/finance/escrow-split';

describe('RERA 70/30 escrow split (module #50)', () => {
  it('splits a clean amount 70/30', () => {
    const s = splitEscrow(1000);
    expect(s.rera).toBe(700);
    expect(s.general).toBe(300);
    expect(s.total).toBe(1000);
  });

  it('never leaks a rupee — the two legs always re-sum to the total', () => {
    for (const amt of [1, 3, 7, 99, 101, 12345, 999999, 1000003]) {
      const s = splitEscrow(amt);
      expect(s.rera + s.general).toBe(amt);
      // RERA leg is at least 70% (rounding remainder falls to the general leg)
      expect(s.rera).toBeGreaterThanOrEqual(Math.floor(amt * 0.7));
    }
  });

  it('rounds fractional rupees and clamps negatives/NaN to zero', () => {
    expect(splitEscrow(100.4).total).toBe(100);
    expect(splitEscrow(100.6).total).toBe(101);
    expect(splitEscrow(-500)).toEqual({ rera: 0, general: 0, total: 0 });
    expect(splitEscrow(Number.NaN)).toEqual({ rera: 0, general: 0, total: 0 });
  });
});
