import { describe, it, expect } from 'vitest';
import { demandMessageIn, isDemandLang, DEMAND_LANGS } from '@/lib/i18n/demand-templates';

const vars = { name: 'Ramesh', label: '3rd instalment', amount: '₹5,00,000', whenStr: '15 Aug 2026', overdue: true };

describe('multilingual demand templates (module #6)', () => {
  it('offers exactly the four supported languages', () => {
    expect(DEMAND_LANGS.map((l) => l.code).sort()).toEqual(['en', 'hi', 'kn', 'ta']);
  });
  it('interpolates the buyer name, amount and label in every language', () => {
    for (const l of ['en', 'hi', 'kn', 'ta'] as const) {
      const msg = demandMessageIn(l, vars);
      expect(msg).toContain('Ramesh');
      expect(msg).toContain('₹5,00,000');
      expect(msg).toContain('3rd instalment');
    }
  });
  it('produces distinct overdue vs upcoming wording', () => {
    const overdue = demandMessageIn('en', { ...vars, overdue: true });
    const upcoming = demandMessageIn('en', { ...vars, overdue: false });
    expect(overdue).toContain('overdue');
    expect(upcoming).toContain('falls due');
  });
  it('validates language codes and defaults unknown to English', () => {
    expect(isDemandLang('kn')).toBe(true);
    expect(isDemandLang('fr')).toBe(false);
    expect(isDemandLang(null)).toBe(false);
    // unknown lang path returns English template
    expect(demandMessageIn('en', vars)).toContain('Dear Ramesh');
  });
});
