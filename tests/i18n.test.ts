import { describe, it, expect } from 'vitest';
import { t, isLang, LANGS } from '@/lib/i18n';

describe('i18n (31-plan #31)', () => {
  it('returns English unchanged', () => {
    expect(t('Money', 'en')).toBe('Money');
    expect(t('anything at all', 'en')).toBe('anything at all');
  });
  it('translates known strings to Hindi', () => {
    expect(t('Money', 'hi')).toBe('पैसा');
    expect(t('My Day', 'hi')).toBe('मेरा दिन');
  });
  it('falls back to English for untranslated strings (never blank/broken)', () => {
    expect(t('Some brand-new label', 'hi')).toBe('Some brand-new label');
  });
  it('validates language codes', () => {
    expect(isLang('hi')).toBe(true);
    expect(isLang('fr')).toBe(false);
  });
  it('offers English and Hindi', () => {
    expect(LANGS.map((l) => l.code)).toEqual(['en', 'hi']);
  });
});
