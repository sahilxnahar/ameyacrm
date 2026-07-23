/**
 * `collapsed` holds the labels of groups the person has folded shut.
 * `groups` holds the labels of sections in the person's preferred top-to-bottom
 * order — anything they have not dragged keeps its standard position.
 */
export interface NavPrefs { pinned: string[]; order: string[]; hidden: string[]; collapsed: string[]; groups: string[] }

export const EMPTY_PREFS: NavPrefs = { pinned: [], order: [], hidden: [], collapsed: [], groups: [] };

/** Read whatever is stored on the user, tolerating older or malformed shapes. */
export function readPrefs(raw: unknown): NavPrefs {
  if (!raw || typeof raw !== 'object') return EMPTY_PREFS;
  const o = raw as Partial<Record<keyof NavPrefs, unknown>>;
  const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  return { pinned: arr(o.pinned), order: arr(o.order), hidden: arr(o.hidden), collapsed: arr(o.collapsed), groups: arr(o.groups) };
}

/**
 * Apply a person's section ordering. Groups they have dragged come first in
 * their chosen order; any section they never touched keeps its standard place.
 */
export function applyGroupOrder<T extends { label: string }>(groups: T[], prefs: NavPrefs): T[] {
  if (!prefs.groups.length) return groups;
  const rank = new Map(prefs.groups.map((l, i) => [l, i]));
  return [...groups].sort((a, b) => {
    const ra = rank.get(a.label);
    const rb = rank.get(b.label);
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
