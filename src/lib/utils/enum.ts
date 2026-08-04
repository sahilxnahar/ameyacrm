/**
 * Put a string into an enum position, having checked that it belongs there.
 *
 * ── Why this exists (AMH-050) ───────────────────────────────────────────────
 *
 * 93 `as never` casts, and the great majority were one of two shapes:
 *
 *     kind: (v.kind || 'OTHER') as never                       // a write
 *     where: { status: f.status as never }                     // a filter
 *
 * Both take a string that arrived from a form field or a query string and force
 * it into a Prisma enum. `as never` is what makes that compile, and it is worth
 * being precise about what it costs in each case, because they fail
 * differently:
 *
 *   On a WRITE, an invalid value reaches Postgres and the insert throws with an
 *   opaque enum error. Bad, but loud.
 *
 *   On a FILTER, it is worse and silent. Prisma sends the value, nothing
 *   matches, and the screen renders an empty list. `?status=Overdue` (wrong
 *   case) shows "no records" — which reads as a true answer about the data, not
 *   as a rejected input. The whole engagement has been about that shape of bug.
 *
 * The other reason to have this: `as never` is not greppable as a smell. It
 * looks like a type annotation. `asEnum(Status, v, 'OPEN')` says out loud that
 * an untrusted string is entering a closed set.
 */

/**
 * A validated enum value, or the fallback.
 *
 * Pass the enum object Prisma generates — `import { LeadStatus } from
 * '@prisma/client'` — so the accepted set comes from the schema and cannot
 * drift from it.
 */
export function asEnum<T extends Record<string, string>>(
  values: T,
  candidate: unknown,
  fallback: T[keyof T],
): T[keyof T] {
  if (typeof candidate !== 'string') return fallback;
  return Object.prototype.hasOwnProperty.call(values, candidate)
    ? (candidate as T[keyof T])
    : fallback;
}

/**
 * A validated enum value, or `undefined`.
 *
 * For `where` clauses: spreading `undefined` drops the key, so an unrecognised
 * filter value means "no filter" rather than "filter that matches nothing".
 * That is the difference between a screen showing everything and a screen
 * showing an empty list that looks like an answer.
 *
 *     ...(asEnumOrUndefined(LeadStatus, f.status) ? { status: … } : {})
 */
export function asEnumOrUndefined<T extends Record<string, string>>(
  values: T,
  candidate: unknown,
): T[keyof T] | undefined {
  if (typeof candidate !== 'string') return undefined;
  return Object.prototype.hasOwnProperty.call(values, candidate)
    ? (candidate as T[keyof T])
    : undefined;
}
