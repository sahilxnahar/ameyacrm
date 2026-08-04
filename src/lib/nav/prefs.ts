/**
 * `collapsed` holds the labels of groups the person has folded shut.
 * `groups` holds the labels of sections in the person's preferred top-to-bottom
 * order — anything they have not dragged keeps its standard position.
 */
/**
 * `tones` and `weights` are per-screen personal overrides of the colour and the
 * tile size defined in `config/module-style.ts`. They live in the same JSON
 * column as the rest of the menu preferences, so making the launchpad
 * customisable needed no schema change and no migration for anyone to run.
 */
export interface NavPrefs {
  pinned: string[]; order: string[]; hidden: string[]; collapsed: string[]; groups: string[];
  tones: Record<string, string>;
  weights: Record<string, string>;
}

export const EMPTY_PREFS: NavPrefs = { pinned: [], order: [], hidden: [], collapsed: [], groups: [], tones: {}, weights: {} };

/** Read whatever is stored on the user, tolerating older or malformed shapes. */
export function readPrefs(raw: unknown): NavPrefs {
  if (!raw || typeof raw !== 'object') return EMPTY_PREFS;
  const o = raw as Partial<Record<keyof NavPrefs, unknown>>;
  const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  const map = (v: unknown): Record<string, string> => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
    const out: Record<string, string> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (typeof val === 'string') out[k] = val;
    }
    return out;
  };
  return {
    pinned: arr(o.pinned), order: arr(o.order), hidden: arr(o.hidden),
    collapsed: arr(o.collapsed), groups: arr(o.groups),
    tones: map(o.tones), weights: map(o.weights),
  };
}

/**
 * A saved menu preference survives the section being renamed.
 *
 * `groups` and `collapsed` store section LABELS, which means a preference saved
 * before a label was reworded stops matching it. That is not hypothetical: the
 * sections were renamed from Title Case to sentence case in v16.15, and every
 * person who had dragged their menu into a preferred order would silently have
 * had it reset to the default, with nothing to indicate why. Comparing on a
 * normalised form makes the stored value tolerant of casing and punctuation, so
 * "Sales & Leads" saved last month still matches "Sales & leads" today.
 */
export const normaliseLabel = (s: string) =>
  s.toLowerCase().replace(/&|\band\b/g, '&').replace(/[^a-z&]+/g, '');

/**
 * Apply a person's section ordering. Groups they have dragged come first in
 * their chosen order; any section they never touched keeps its standard place.
 */
export function applyGroupOrder<T extends { label: string }>(groups: T[], prefs: NavPrefs): T[] {
  if (!prefs.groups.length) return groups;
  const rank = new Map(prefs.groups.map((l, i) => [normaliseLabel(l), i]));
  return [...groups].sort((a, b) => {
    const ra = rank.get(normaliseLabel(a.label));
    const rb = rank.get(normaliseLabel(b.label));
    if (ra === undefined && rb === undefined) return 0;
    if (ra === undefined) return 1;
    if (rb === undefined) return -1;
    return ra - rb;
  });
}

/**
 * Apply a person's ordering to one group of links. Anything they have not
 * touched keeps its original position, so a newly added page still appears.
 */
export function applyOrder<T extends { href: string }>(
  items: T[],
  prefs: NavPrefs,
  opts: { keepHidden?: boolean } = {},
): T[] {
  // While customising, hidden items must stay on screen (greyed out) or there
  // is no way to un-hide them.
  const visible = opts.keepHidden ? items : items.filter((i) => !prefs.hidden.includes(i.href));
  if (!prefs.order.length) return visible;
  const rank = new Map(prefs.order.map((h, i) => [h, i]));
  return [...visible].sort((a, b) => {
    const ra = rank.get(a.href);
    const rb = rank.get(b.href);
    if (ra === undefined && rb === undefined) return 0;
    if (ra === undefined) return 1;
    if (rb === undefined) return -1;
    return ra - rb;
  });
}
