import type { NextRequest } from 'next/server';

/**
 * Is this state-changing request coming from our own pages?
 *
 * ── What was already true ───────────────────────────────────────────────────
 *
 * The session cookie is `sameSite: 'lax'`, so a browser will not attach it to a
 * cross-SITE POST. Classic form-post CSRF against the API was therefore already
 * blocked before this file existed, and the audit finding (AMH-049, "no origin
 * check on 29 mutating API routes") overstated the exposure. Next.js also
 * validates Origin against Host for Server Actions itself, so those were never
 * the gap either.
 *
 * ── What was not ────────────────────────────────────────────────────────────
 *
 * Two holes remain, and both are the reason this is worth having:
 *
 *   1. `SameSite=Lax` treats every subdomain as the same site. A compromised or
 *      third-party-hosted `something.ameyaheights.com` can POST to the CRM and
 *      the browser WILL send the session cookie. Lax does nothing about it.
 *   2. It is a browser-side control. A client that does not implement SameSite
 *      sends the cookie regardless.
 *
 * ── The rule ────────────────────────────────────────────────────────────────
 *
 * Only requests that carry a SESSION COOKIE are checked. That is the whole
 * design, and it is what keeps this from breaking things:
 *
 *   - Razorpay, WhatsApp and the other webhooks authenticate with a signature
 *     or a shared secret and carry no cookie, so they are never checked.
 *   - The SAML assertion is a cross-origin POST from the identity provider,
 *     also with no cookie of ours.
 *   - Public API callers use a bearer token, not a cookie.
 *
 * A cookie is the only credential a browser attaches automatically, so a cookie
 * is the only credential that can be used against its owner's wishes. Checking
 * exactly those requests is both sufficient and safe.
 */

/** Methods that can change state. HEAD/GET/OPTIONS cannot, by contract. */
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function isMutating(method: string): boolean {
  return MUTATING.has(method.toUpperCase());
}

/**
 * Decide whether a cookie-bearing mutating request may proceed.
 *
 * Returns null when the request is fine, or a short reason when it is not.
 */
export function crossOriginReason(req: NextRequest, appUrl: string): string | null {
  /*
   * `Sec-Fetch-Site` is the browser's own account of where the request came
   * from, and it cannot be set by page script. Preferred where present.
   *
   *   same-origin  — our page, our origin
   *   same-site    — a SIBLING SUBDOMAIN. Refused: this is hole (1) above.
   *   cross-site   — refused
   *   none         — typed in the address bar or a bookmark; no page initiated
   *                  it, so there is nothing to forge. Allowed.
   */
  const fetchSite = req.headers.get('sec-fetch-site');
  if (fetchSite) {
    if (fetchSite === 'same-origin' || fetchSite === 'none') return null;
    return `sec-fetch-site: ${fetchSite}`;
  }

  // Older clients: fall back to Origin, then Referer.
  const stated = req.headers.get('origin') ?? req.headers.get('referer');
  if (!stated) {
    // No Sec-Fetch-Site, no Origin, no Referer — and yet a session cookie. No
    // browser sends a cookie-bearing POST with none of the three, so this is
    // not a browser, and a non-browser has no business using cookie auth.
    return 'no origin, referer or sec-fetch-site';
  }

  let statedOrigin: string;
  try {
    statedOrigin = new URL(stated).origin;
  } catch {
    return 'unparseable origin';
  }

  // Compare against the host actually serving the request, so this keeps
  // working on preview deployments and behind a proxy. APP_URL is the fallback
  // for the case where no forwarded host is present.
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') ?? 'https';
  const candidates = new Set<string>();
  if (host) candidates.add(`${proto}://${host}`);
  try { candidates.add(new URL(appUrl).origin); } catch { /* APP_URL unset or malformed */ }

  return candidates.has(statedOrigin) ? null : `origin ${statedOrigin}`;
}
