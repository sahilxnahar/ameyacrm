import 'server-only';

/**
 * How many rows a list screen shows, and how to see the rest.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 *
 * Counted during the August 2026 audit: 290 `take:` clauses in the codebase and
 * **zero** `skip:`. There is no pagination anywhere in the product. Every list
 * fetches the first N rows and renders them with no indication that there are
 * more — so a list of 200 MSME clocks against 1,340 real ones looks exactly
 * like a complete list of 200.
 *
 * The danger is not "I cannot reach page 2". It is that someone filters a
 * screen, reads the result, and believes it is the answer. On the MSME tracker
 * that is a s.43B(h) disallowance nobody saw; on GSTR reconciliation it is
 * input credit quietly left on the table; on the vendor registry it is a
 * blacklisted supplier who still looks clean.
 *
 * ── The shape of the fix ────────────────────────────────────────────────────
 *
 * Two parts, and the first matters more than the second:
 *
 *   1. TELL THE TRUTH. Fetch the total alongside the window and say
 *      "Showing 200 of 1,340" whenever they differ. Cheap — one extra COUNT,
 *      which runs in parallel — and it turns a silent wrong answer into a
 *      visible partial one.
 *
 *   2. OFFER THE REST. `?rows=all` raises the window to `MAX_WINDOW`. Not
 *      infinite: a genuinely unbounded fetch is how a list screen takes the
 *      server down, and it is the reason the caps were put there originally.
 *      When even that is not enough the notice says so rather than pretending.
 *
 * Sorting is deliberately downstream of this. Sorting a truncated list CLIENT
 * SIDE is worse than not sorting it: "by amount, largest first" then shows the
 * largest of an arbitrary 200, which reads as the largest overall. Any column
 * offered for sorting must either sort in the database or be sorting a set the
 * screen is showing in full.
 */

/** The default window. Chosen per screen; this is the fallback. */
export const DEFAULT_WINDOW = 200;

/**
 * The ceiling when someone asks for everything.
 *
 * High enough to hold a real Ameya data set, low enough that one person opening
 * one screen cannot exhaust the request's memory. If a list legitimately
 * exceeds this, the answer is an export, not a bigger web page.
 */
export const MAX_WINDOW = 5000;

export interface ListWindow {
  /** Pass straight to Prisma's `take`. */
  take: number;
  /** True when the caller asked for everything. */
  showingAll: boolean;
}

type SearchParams = Record<string, string | string[] | undefined> | undefined;

/** Read `?rows=all` off a server component's searchParams. */
export function listWindow(searchParams: SearchParams, fallback = DEFAULT_WINDOW): ListWindow {
  const raw = searchParams?.rows;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === 'all') return { take: MAX_WINDOW, showingAll: true };
  return { take: fallback, showingAll: false };
}

export interface ListMeta {
  /** How many rows are on screen. */
  shown: number;
  /** How many exist. */
  total: number;
  /** True when `total > shown`. */
  truncated: boolean;
  /** True when even `?rows=all` could not fit them. */
  cappedAtMax: boolean;
}

/**
 * Work out what to tell the reader.
 *
 * `total` comes from a COUNT with the SAME where clause as the findMany — if
 * the two disagree the notice is worse than useless, because it reports a
 * truncation that is not there or misses one that is.
 */
export function listMeta(shown: number, total: number, window: ListWindow): ListMeta {
  return {
    shown,
    total,
    truncated: total > shown,
    cappedAtMax: window.showingAll && total > shown,
  };
}
