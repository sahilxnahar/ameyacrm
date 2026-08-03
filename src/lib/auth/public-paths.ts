/**
 * Routes reachable WITHOUT a session.
 *
 * Kept in its own module, with no imports, so both the Edge middleware and a
 * test can read the same list. A hand-maintained allow-list that only one file
 * can see is a list nobody notices is wrong.
 *
 * Two things went wrong with the previous version, in opposite directions.
 *
 * TOO SHORT: `/forgot-password`, `/reset-password` and `/set-password` were
 * missing, so every password-reset email and every invitation link redirected
 * the person to `/login` — the exact screen they could not get past. Nobody
 * could reset a password, and no invited user could ever accept. It failed
 * silently, because being bounced to a login page looks like the system
 * working. `/cp` and `/vendor-portal` were missing for the same reason: both
 * are handed to people outside the company who have no account at all.
 *
 * TOO LONG: matching was `pathname.startsWith(p)`, so `/pay` also matched
 * `/payments` and quietly took the signed-in payments screen out of the gate.
 * Matching is now on whole path segments — `/pay` matches `/pay` and
 * `/pay/anything`, and never `/payments`.
 *
 * None of this is the security boundary. `requireAuth()` re-checks the session
 * against the database on every server render, and each portal validates its
 * own token; the middleware is a cheap presence gate in front of that. Which is
 * exactly why the cost of the list being wrong falls on availability — people
 * locked out of their own recovery — rather than on data.
 */
export const PUBLIC_PATHS = [
  // Signing in, and every way back in when you cannot.
  '/login', '/signup', '/forgot-password', '/reset-password', '/set-password',
  '/verify', '/device-check', '/two-factor', '/api/auth',
  // Token-gated surfaces for people with no account: buyers, channel partners,
  // vendors, e-signature recipients, payment pages.
  '/portal', '/cp', '/vendor-portal', '/sign', '/pay',
  // First-run, plan picker and the access-denied screen.
  '/install', '/plan', '/setup', '/forbidden',
] as const;

/**
 * Whole-segment prefix match: `/pay` covers `/pay` and `/pay/abc`, never
 * `/payments`.
 */
export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
