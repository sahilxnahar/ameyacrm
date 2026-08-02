import { describe, it, expect } from 'vitest';
import { towerUnitCode } from '@/lib/inventory/tower-codes';

describe('tower unit codes', () => {
  it('numbers a floor from the given start, zero-padded', () => {
    expect(towerUnitCode('A', 12, 0, 'NUMERIC', 1)).toBe('A-1201');
    expect(towerUnitCode('A', 12, 3, 'NUMERIC', 1)).toBe('A-1204');
  });

  it('respects a start other than 1 — some towers number from 01, some from 05', () => {
    expect(towerUnitCode('B', 3, 0, 'NUMERIC', 5)).toBe('B-305');
  });

  it('letters the units where that is the convention', () => {
    expect(towerUnitCode('A', 12, 0, 'ALPHA', 1)).toBe('A-12A');
    expect(towerUnitCode('A', 12, 2, 'ALPHA', 1)).toBe('A-12C');
  });

  it('does not collapse past the 26th unit on a floor', () => {
    // Beyond Z there is no letter, and two units must never share a code.
    expect(towerUnitCode('A', 1, 26, 'ALPHA', 1)).toBe('A-127');
  });

  it('writes basements as B1, B2 rather than a double hyphen', () => {
    expect(towerUnitCode('A', 0, 0, 'NUMERIC', 1)).toBe('A-001');
    expect(towerUnitCode('A', -1, 0, 'NUMERIC', 1)).toBe('A-B101');
    expect(towerUnitCode('A', -2, 1, 'NUMERIC', 1)).toBe('A-B202');
  });

  it('generates a whole tower without a single duplicate', () => {
    const codes = new Set<string>();
    for (let f = 1; f <= 12; f++) for (let i = 0; i < 4; i++) codes.add(towerUnitCode('A', f, i, 'NUMERIC', 1));
    expect(codes.size).toBe(48);
  });
});
