import 'server-only';
import { unstable_cache, revalidateTag } from 'next/cache';
import { prisma } from '@/lib/db/prisma';

/**
 * Cross-request caching for the settings every page load reads.
 *
 * ── Why ─────────────────────────────────────────────────────────────────────
 *
 * The company details, the terminology overrides and the pipeline stage config
 * are single `Setting` rows. They are identical for every user in the
 * organisation, they change perhaps once a quarter, and they are read on
 * essentially every page load — the company name is in the header, the
 * terminology map renames labels throughout the shell.
 *
 * They were wrapped in React `cache()`, which dedupes within ONE render. That is
 * worth having, but it means every request still pays for the round-trip. At one
 * user that is invisible. At a thousand concurrent users it is a thousand
 * identical `SELECT * FROM "Setting" WHERE key = 'company.details'` per page
 * load, for a row that has not changed since March.
 *
 * `unstable_cache` caches across requests and across instances. The staleness
 * that usually makes that a bad trade is handled by the tag: `saveCompany` and
 * `saveTerms` call `revalidateSetting`, so a change is visible on the next page
 * load rather than after a timeout. The `revalidate` window below is a backstop
 * for anything that writes the row without going through those actions — a
 * direct SQL edit, a restore from backup.
 *
 * ── Why not cache more than this ────────────────────────────────────────────
 *
 * Only rows that are (a) organisation-wide, (b) read on most page loads and
 * (c) written through a known action belong here. Anything per-user must not be
 * — `unstable_cache` has no notion of who is asking, and a cache keyed only by
 * setting name would serve one user's data to another. That is the failure mode
 * to be careful of, so the helper below takes a key and nothing else, and cannot
 * be handed a user id by accident.
 */

/** A backstop, not the mechanism. Correctness comes from the tag. */
const SETTINGS_TTL_SECONDS = 300;

const tagFor = (key: string) => `setting:${key}`;

/**
 * Read one organisation-wide `Setting` row, cached across requests.
 *
 * Returns the raw JSON value, or null when the row does not exist — callers
 * merge it over their own defaults, exactly as they did before.
 */
export function readSetting<T>(key: string): Promise<T | null> {
  return unstable_cache(
    async () => {
      const row = await prisma.setting.findUnique({ where: { key } });
      return (row?.value ?? null) as T | null;
    },
    ['setting', key],
    { tags: [tagFor(key)], revalidate: SETTINGS_TTL_SECONDS },
  )();
}

/**
 * Drop the cached copy of one setting. Call this from every action that writes
 * it — including the reset paths, which are easy to forget and produce the
 * worst symptom: "I reset it and nothing happened."
 */
export function revalidateSetting(key: string): void {
  revalidateTag(tagFor(key));
}
