import { describe, it, expect } from 'vitest';
import { deviationPct, ocRisk } from '@/lib/planning/far';

describe('FAR / OC deviation (module #56)', () => {
  it('computes deviation percentage of built vs sanctioned FAR', () => {
    expect(deviationPct(2.0, 2.0)).toBe(0);
    expect(deviationPct(2.0, 2.1)).toBe(5);
    expect(deviationPct(2.0, 2.2)).toBe(10);
    expect(deviationPct(0, 2)).toBe(0); // safe on zero sanctioned
  });
  it('flags OC AT_RISK once deviation exceeds tolerance', () => {
    expect(ocRisk(2.0, 2.2)).toBe('AT_RISK'); // 10% over
    expect(ocRisk(2.0, 2.05)).toBe('WATCH');  // 2.5% over, within 5%
    expect(ocRisk(2.0, 1.5)).toBe('OK');       // well under
  });
  it('moves to WATCH as built nears the sanctioned limit', () => {
    expect(ocRisk(2.0, 1.95)).toBe('WATCH'); // 97.5% utilised
  });
});
