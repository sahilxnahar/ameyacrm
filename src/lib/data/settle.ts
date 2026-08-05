import 'server-only';

/**
 * ── AMH-007: "empty" and "broken" must not render identically ───────────────
 *
 * The audit counted 325 swallowed errors. The dangerous shape is not the
 * side-effect one — `writeAudit(…).catch(() => undefined)` is correct, an audit
 * write failing must not undo the operation it describes. It is this one:
 *
 *     prisma.insurancePolicy.findMany({ where: expiringSoon }).catch(() => [])
 *
 * because an empty array and a failed query produce the same screen, and that
 * screen says **"Nothing expiring in the next 90 days."**
 *
 * On a contracts, insurance, licence or power-of-attorney register, a false
 * all-clear is the entire risk the register exists to manage. The person reads
 * it, believes it, and closes the tab. The failure has produced no evidence of
 * having failed — which is the theme running through this whole finding.
 *
 * The catch cannot simply be removed: one bad query would take a whole page
 * down, which is why they were added in the first place. So the fallback stays
 * and the failure travels WITH it. The caller gets the rows it could get, plus
 * a count of the sources that did not answer, and the screen can say so.
 *
 * Use `settle` for anything a person reads as a statement about their data.
 * Keep a bare `.catch` for genuinely optional side-effects.
 */

export interface Settled<T> {
  data: T;
  /** Labels of the sources that threw. Empty means the answer is complete. */
  failures: string[];
}

/**
 * Run a query, and on failure return the fallback WITH the failure recorded.
 *
 * The error is logged rather than discarded — a swallowed error that is not
 * even logged is unfixable, because nothing anywhere records that it happened.
 */
export async function settle<T>(label: string, run: () => Promise<T>, fallback: T): Promise<Settled<T>> {
  try {
    return { data: await run(), failures: [] };
  } catch (err) {
    console.error(`[data] ${label} failed:`, err instanceof Error ? err.message : err);
    return { data: fallback, failures: [label] };
  }
}

/** Combine several settled reads into one, concatenating their failures. */
export function settleAll<T extends readonly Settled<unknown>[]>(...parts: T): { failures: string[] } {
  return { failures: parts.flatMap((p) => p.failures) };
}

/**
 * The sentence a screen shows when part of its data did not load.
 *
 * Deliberately plain, and deliberately NOT reassuring: the point is that the
 * list in front of you is incomplete, so do not act on its emptiness.
 */
export function incompleteMessage(failures: string[]): string | null {
  if (failures.length === 0) return null;
  const what = failures.length === 1 ? failures[0] : `${failures.length} sources`;
  return `Could not load ${what}. This list is incomplete — do not treat it as "nothing due".`;
}
