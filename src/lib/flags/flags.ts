/**
 * Feature flags — ship a batch dark, turn it on for yourself first, roll it back
 * without a redeploy. On a live system the company runs on, this is the safe way
 * to keep shipping fast: a new screen can be merged and deployed switched off,
 * proven in production, then enabled.
 *
 * The source of truth is a single env var, `FEATURE_FLAGS`, a comma-separated
 * list of enabled flag keys (e.g. `FEATURE_FLAGS=live-updates,command-palette`).
 * No new table, no dependency — it reads the environment, which Vercel lets you
 * change without a redeploy. A per-user override table is a later refinement;
 * this is the mechanism, kept deliberately small.
 *
 * Pure and dependency-free so it can be imported anywhere (server or, via a
 * passed-in value, client) and unit-tested.
 */

export const FLAG_KEYS = [
  'live-updates',        // batch 14 — real-time reactivity
  'command-palette',     // batch 6 — command palette
  'inline-editing',      // batch 16 — spreadsheet-style editing
  'offline-sync',        // batch 15 — background sync
  'instant-search',      // batch 17 — typeahead search
  'react-compiler',      // batch 18 — behind-the-scenes rollout guard
] as const;

export type FlagKey = (typeof FLAG_KEYS)[number];

/** Parse a raw flag string (comma/space separated) into a set of enabled keys. */
export function parseFlags(raw: string | undefined | null): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(/[,\s]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** Is a flag enabled, given the parsed set? Pure — the caller supplies the set. */
export function flagEnabled(enabled: Set<string>, key: FlagKey): boolean {
  return enabled.has(key);
}

/**
 * Server-side convenience: read the environment once and answer for a key.
 * Safe to call from server components and actions. Never throws.
 */
export function isFeatureEnabled(key: FlagKey): boolean {
  try {
    return parseFlags(process.env.FEATURE_FLAGS).has(key);
  } catch {
    return false;
  }
}

/** The full enabled set from the environment, for handing to a client component. */
export function enabledFlags(): FlagKey[] {
  const set = parseFlags(process.env.FEATURE_FLAGS);
  return FLAG_KEYS.filter((k) => set.has(k));
}
