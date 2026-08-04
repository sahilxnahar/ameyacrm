import 'server-only';

/**
 * Sorting a list screen, in the database.
 *
 * ── Why not client-side ─────────────────────────────────────────────────────
 *
 * Counted during the August 2026 audit: three sortable columns in the entire
 * application, all three in one file. The obvious fix is a click handler that
 * sorts the array the table already has.
 *
 * That fix would be worse than the gap. Every list screen shows a WINDOW — the
 * first 200 or 300 rows in some fixed order (see lib/list/page-window.ts).
 * Sorting that array by amount descending shows the largest of the two hundred
 * that happened to be fetched, presented as the largest overall. Somebody
 * checking "what is our biggest outstanding bill" gets a confident, specific,
 * wrong answer — and unlike a truncated list, nothing about the screen hints
 * that it is partial, because sorting feels like it has considered everything.
 *
 * So the sort goes in the ORDER BY, next to the `take`. The window then
 * contains the top 200 by whatever was asked for, which is what the reader
 * believes they are looking at.
 *
 * ── Why a whitelist ─────────────────────────────────────────────────────────
 *
 * The sort key arrives from the query string, and it is interpolated into a
 * Prisma `orderBy`. Passing it through unchecked lets a caller order by any
 * column — including ones deliberately kept off the screen — and reading a
 * table's ordering is a slow but real way to read values out of it. Each screen
 * declares the columns it will sort by; anything else falls back to the default.
 */

export interface SortSpec<K extends string> {
  /** Columns this screen allows, mapped to the Prisma orderBy they produce. */
  columns: Record<K, Record<string, unknown> | Array<Record<string, unknown>>>;
  /** Used when the query string asks for nothing, or asks for nonsense. */
  fallback: K;
  /** Which way an un-suffixed key sorts. Dates usually want desc, names asc. */
  defaultDirection?: 'asc' | 'desc';
}

export interface ResolvedSort<K extends string> {
  key: K;
  direction: 'asc' | 'desc';
  /** Hand straight to Prisma. */
  orderBy: Record<string, unknown> | Array<Record<string, unknown>>;
}

type SearchParams = Record<string, string | string[] | undefined> | undefined;

const flip = (v: unknown, dir: 'asc' | 'desc'): unknown => {
  // The spec declares each column's natural ordering; `dir` may invert it.
  if (Array.isArray(v)) return v.map((x) => flip(x, dir));
  if (v && typeof v === 'object') {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>).map(([k, val]) =>
        [k, val === 'asc' || val === 'desc' ? dir : flip(val, dir)],
      ),
    );
  }
  return v;
};

/**
 * Read `?sort=amount&dir=desc` and turn it into an orderBy.
 *
 * An unknown key, or a direction that is not exactly 'asc' or 'desc', falls
 * back silently rather than erroring: a stale bookmark should show the screen,
 * not a stack trace.
 */
export function resolveSort<K extends string>(
  searchParams: SearchParams,
  spec: SortSpec<K>,
): ResolvedSort<K> {
  const raw = searchParams?.sort;
  const asked = (Array.isArray(raw) ? raw[0] : raw) ?? '';
  const key = (Object.prototype.hasOwnProperty.call(spec.columns, asked) ? asked : spec.fallback) as K;

  const rawDir = searchParams?.dir;
  const askedDir = Array.isArray(rawDir) ? rawDir[0] : rawDir;
  const direction: 'asc' | 'desc' =
    askedDir === 'asc' || askedDir === 'desc' ? askedDir : (spec.defaultDirection ?? 'asc');

  return { key, direction, orderBy: flip(spec.columns[key], direction) as ResolvedSort<K>['orderBy'] };
}
