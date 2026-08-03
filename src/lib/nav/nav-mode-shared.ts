/**
 * The parts of the nav-mode preference that BOTH sides need.
 *
 * No `'use client'` directive, deliberately. Its sibling `nav-mode.ts` has one,
 * because `readNavMode`/`writeNavMode` touch `document` — and that directive
 * applies to the whole module, so every export in it becomes a client
 * reference. The signed-in layout is a server component and imported
 * `navModeFromCookie` from there, which is fine at build time and throws at
 * runtime in a production build:
 *
 *   Attempted to call navModeFromCookie() from the server but navModeFromCookie
 *   is on the client.
 *
 * A layout cannot catch its own error, so it bubbled to the root boundary and
 * every signed-in screen in the CRM became "Something went wrong" — with no
 * database problem anywhere, which is why days were spent looking at the
 * schema. `tests/server-client-boundary.test.ts` now fails if a server file
 * imports from a `'use client'` module again.
 */

export type NavMode = 'essentials' | 'everything';

export const NAV_MODE_KEY = 'amh:nav-mode';
export const NAV_MODE_COOKIE = 'amh_nav_mode';
export const DEFAULT_NAV_MODE: NavMode = 'essentials';

/** Parse the cookie header. Pure — safe on the server and in the browser. */
export function navModeFromCookie(value: string | undefined): NavMode {
  return value === 'everything' || value === 'essentials' ? value : DEFAULT_NAV_MODE;
}
