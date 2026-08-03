'use client';

/**
 * How much of the menu to show.
 *
 * Two modes, because people genuinely split into two camps and neither is
 * wrong:
 *
 *  - **Essentials** — the eight screens most people use daily, plus whatever
 *    they pinned and where they have just been. Everything else is one ⌘K away.
 *    This is the default because a newcomer recognising eight items will find
 *    their way; a newcomer reading 120 will not.
 *
 *  - **Everything** — the full grouped menu, all 120 items. For somebody who has
 *    learned the app and would rather see the whole map than search for it.
 *
 * Stored per device in a COOKIE rather than localStorage. localStorage cannot
 * be read on the server, so the first render always assumed the default and the
 * real menu only appeared one commit later — anyone who chose "Everything" saw
 * the short list paint and then jump on every single load. A cookie is sent
 * with the request, so the server renders the right menu the first time.
 */

// The shared, server-safe half lives in its own module WITHOUT a 'use client'
// directive, because that directive applies to a whole file: while these lived
// here, a server component importing `navModeFromCookie` compiled fine and threw
// at runtime, taking every signed-in screen down with it.
export { NAV_MODE_KEY, NAV_MODE_COOKIE, DEFAULT_NAV_MODE, navModeFromCookie } from './nav-mode-shared';
import { NAV_MODE_KEY, NAV_MODE_COOKIE, DEFAULT_NAV_MODE } from './nav-mode-shared';
export type { NavMode } from './nav-mode-shared';
import type { NavMode } from './nav-mode-shared';

export function readNavMode(): NavMode {
  if (typeof window === 'undefined') return DEFAULT_NAV_MODE;
  const fromCookie = document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${NAV_MODE_COOKIE}=`))
    ?.split('=')[1];
  if (fromCookie === 'everything' || fromCookie === 'essentials') return fromCookie;
  try {
    const v = window.localStorage.getItem(NAV_MODE_KEY);
    return v === 'everything' || v === 'essentials' ? v : DEFAULT_NAV_MODE;
  } catch {
    return DEFAULT_NAV_MODE;
  }
}

export function writeNavMode(mode: NavMode): void {
  try {
    // A year, path-wide, lax — a display preference, not a credential.
    document.cookie = `${NAV_MODE_COOKIE}=${mode}; path=/; max-age=31536000; samesite=lax`;
    window.localStorage.setItem(NAV_MODE_KEY, mode);
    document.documentElement.setAttribute('data-nav-mode', mode);
    // Tell any mounted sidebar to re-read, without a page reload.
    window.dispatchEvent(new CustomEvent('amh:nav-mode', { detail: mode }));
  } catch {
    /* a browser refusing storage must not break navigation */
  }
}
