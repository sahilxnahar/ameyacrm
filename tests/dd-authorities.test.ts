import { describe, it, expect } from 'vitest';
import { DD_DIRECTORY, DD_AUTHORITIES_FLAT, searchAuthorities } from '@/config/dd-authorities';

describe('Pan-India due-diligence directory', () => {
  it('covers all six required states with authorities each', () => {
    const states = DD_DIRECTORY.map((s) => s.state);
    for (const s of ['Tamil Nadu', 'Madhya Pradesh', 'Rajasthan', 'Maharashtra', 'Karnataka', 'Delhi / NCR']) {
      expect(states).toContain(s);
    }
    for (const s of DD_DIRECTORY) expect(s.authorities.length).toBeGreaterThan(0);
  });
  it('every authority has an https portal URL', () => {
    for (const a of DD_AUTHORITIES_FLAT) expect(a.url).toMatch(/^https:\/\//);
  });
  it('search finds the specific authorities the brief calls out', () => {
    expect(searchAuthorities('CMDA').some((a) => a.name.includes('CMDA'))).toBe(true);
    expect(searchAuthorities('Kodaikanal HACA').some((a) => a.name.includes('HACA'))).toBe(true);
    expect(searchAuthorities('Indore Bhulekh').some((a) => a.name.includes('Bhulekh'))).toBe(true);
    expect(searchAuthorities('PMRDA').some((a) => a.region === 'Pune')).toBe(true);
  });
  it('returns the full list for an empty query', () => {
    expect(searchAuthorities('')).toHaveLength(DD_AUTHORITIES_FLAT.length);
  });
});
