/**
 * The URL a sortable column heading points at.
 *
 * Lives apart from lib/list/sort.ts because that module is `server-only` — it
 * builds Prisma orderBy clauses — while the heading that links to it renders in
 * the browser. This half is pure URL arithmetic and belongs to both.
 */
export function sortHref(
  current: { key: string; direction: 'asc' | 'desc' },
  key: string,
  params: Record<string, string | string[] | undefined> | URLSearchParams | undefined,
  startDirection: 'asc' | 'desc' = 'asc',
): string {
  const next = current.key === key ? (current.direction === 'asc' ? 'desc' : 'asc') : startDirection;
  const q = new URLSearchParams();
  // Preserve everything else on the URL. Losing `?rows=all` when someone sorts
  // would silently shrink the list back under them — and they would be looking
  // at the top of a window they had deliberately opened up.
  const entries: Array<[string, string]> = params instanceof URLSearchParams
    ? [...params.entries()]
    : Object.entries(params ?? {}).flatMap(([k, v]) => {
        const val = Array.isArray(v) ? v[0] : v;
        return val == null ? [] : [[k, val] as [string, string]];
      });
  for (const [k, v] of entries) {
    if (k === 'sort' || k === 'dir') continue;
    q.set(k, v);
  }
  q.set('sort', key);
  q.set('dir', next);
  return `?${q.toString()}`;
}
