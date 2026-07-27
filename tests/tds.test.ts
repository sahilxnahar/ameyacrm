import { describe, it, expect } from 'vitest';
import { computeTds, suggestTdsSection } from '@/lib/tax/tds';
import { TDS_SECTION_CODES } from '@/config/tds-sections';

describe('TDS engine (v15.52)', () => {
  it('applies the section rate above the threshold', () => {
    const r = computeTds({ sectionCode: '194J', base: 100000, hasPan: true });
    expect(r.rate).toBe(10);
    expect(r.amount).toBe(10000);
    expect(r.net).toBe(90000);
  });

  it('deducts nothing at or below the section threshold', () => {
    const r = computeTds({ sectionCode: '194C', base: 25000 }); // below 30,000
    expect(r.amount).toBe(0);
    expect(r.net).toBe(25000);
  });

  it('applies the higher s.206AA rate when there is no PAN', () => {
    const r = computeTds({ sectionCode: '194C', base: 100000, hasPan: false });
    expect(r.rate).toBe(20);
    expect(r.amount).toBe(20000);
    expect(r.reason).toMatch(/206AA/);
  });

  it('returns zero for an unknown section', () => {
    const r = computeTds({ sectionCode: 'XYZ', base: 100000 });
    expect(r.section).toBeNull();
    expect(r.amount).toBe(0);
  });

  it('suggests a section from the vendor default first, else keywords', () => {
    expect(suggestTdsSection({ vendorDefault: '194I-LAND' })).toBe('194I-LAND');
    expect(suggestTdsSection({ text: 'monthly office rent' })).toBe('194I-LAND');
    expect(suggestTdsSection({ text: 'legal professional fees' })).toBe('194J');
    expect(suggestTdsSection({ accountCode: '6300', text: 'brokerage' })).toBe('194H');
    expect(suggestTdsSection({ text: 'nothing relevant here' })).toBeNull();
  });

  it('every section code is well-formed', () => {
    for (const c of TDS_SECTION_CODES) expect(c).toMatch(/^19[0-9]/);
  });
});
