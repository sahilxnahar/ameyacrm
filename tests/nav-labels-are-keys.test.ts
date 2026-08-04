import { describe, expect, it } from 'vitest';
import { NAVIGATION } from '../src/config/navigation';
import { GROUP_TONE, groupTone } from '../src/config/module-style';

/*
 * A menu label is a display string that four other files quietly use as a key.
 *
 * Renaming the groups from Title Case to sentence case — a pure readability
 * change — unkeyed the tone map, the guide intros, the glossary's "where"
 * column and the entire Hindi dictionary at once. Nothing threw. Every colour
 * silently fell back to brass and every Hindi menu heading silently fell back
 * to English, and neither is visible in a diff or a type error.
 *
 * The lookup is now normalised so casing cannot break it again, but the deeper
 * rule is that a label used as a key needs a test saying so. This is that test.
 */
describe('every menu group resolves everything keyed on its label', () => {
  const groups = NAVIGATION.map((g) => g.label);

  it('has ten groups', () => {
    expect(groups).toHaveLength(10);
  });

  it('gives every group a real tone, not the brass fallback', () => {
    // 'My day' is legitimately brass; every other group must resolve to its own.
    const fellBack = groups.filter((g) => groupTone(g) === 'day' && !/my day/i.test(g));
    expect(fellBack, `these groups lost their colour: ${fellBack.join(', ')}`).toEqual([]);
  });

  it('resolves the tone whatever case or separator the label uses', () => {
    expect(groupTone('Build & Site')).toBe('build');
    expect(groupTone('Build & site')).toBe('build');
    expect(groupTone('build and site')).toBe('build');
    expect(groupTone('BUILD & SITE')).toBe('build');
  });

  it('keeps the raw GROUP_TONE record covering every group', () => {
    // Belt and braces: normalisation should not be hiding a genuinely missing entry.
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z]+/g, '');
    const known = Object.keys(GROUP_TONE).map(norm);
    const missing = groups.filter((g) => !known.includes(norm(g)));
    expect(missing, `no tone defined for: ${missing.join(', ')}`).toEqual([]);
  });

  it('translates every group heading into Hindi', async () => {
    const { t } = await import('../src/lib/i18n');
    const untranslated = groups.filter((g) => t(g, 'hi') === g);
    expect(untranslated, `Hindi menu falls back to English for: ${untranslated.join(', ')}`).toEqual([]);
  });

  it('uses sentence case for item labels, not Title Case', () => {
    // Acronyms and proper nouns are fine; two ordinary capitalised words is not.
    const KEEP = /^(AI|API|BIM|BBMP|BDA|BOCW|CRM|EPF|ESI|ESG|FAR|GST|GSTR|HR|IT|KYC|MIS|MSME|NRI|OS|PDF|POCM|RERA|SEBI|TDS|UAN|UPI|ADR|SMS|4D|RA|EC|JDA|IND-AS|NCLT|IBC|SHCIL|ALN|REAT|CLM|Ameya|Google|Sheets|Drive|Tally|Gmail|Slack|WhatsApp|Khata|India|Pan-India|My|I)$/;
    const offenders: string[] = [];
    for (const g of NAVIGATION) {
      for (const i of g.items) {
        // Hyphenated compounds are one word: "e-Stamping" and "Piece-rate" are
        // each a single term, not two, and splitting them produces false hits.
        const words = i.label.split(/[\s/&(),—–]+/).filter(Boolean);
        const capsAfterFirst = words.slice(1).filter((w) => /^[A-Z][a-z]+$/.test(w) && !KEEP.test(w));
        if (capsAfterFirst.length) offenders.push(`${i.label}  (${capsAfterFirst.join(', ')})`);
      }
    }
    expect(offenders, `Title Case menu items:\n  ${offenders.join('\n  ')}`).toEqual([]);
  });
});

describe('a saved menu preference survives the section being renamed', () => {
  it('keeps a person\'s section order after a label is reworded', async () => {
    const { applyGroupOrder, EMPTY_PREFS } = await import('../src/lib/nav/prefs');
    // Saved last month, under the old Title Case labels.
    const saved = { ...EMPTY_PREFS, groups: ['Money', 'Sales & Leads', 'My Day'] };
    const today = [{ label: 'My day' }, { label: 'Sales & leads' }, { label: 'Money' }];
    expect(applyGroupOrder(today, saved).map((g) => g.label))
      .toEqual(['Money', 'Sales & leads', 'My day']);
  });

  it('falls back gracefully when a section genuinely no longer exists', async () => {
    const { applyGroupOrder, EMPTY_PREFS } = await import('../src/lib/nav/prefs');
    const saved = { ...EMPTY_PREFS, groups: ['A Section That Was Deleted', 'Money'] };
    const today = [{ label: 'Documents' }, { label: 'Money' }];
    // Money is ranked; Documents was never dragged, so it keeps its place after.
    expect(applyGroupOrder(today, saved).map((g) => g.label)).toEqual(['Money', 'Documents']);
  });
});
