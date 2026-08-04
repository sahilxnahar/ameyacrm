import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth/constants';
import { isPublicPath } from '@/lib/auth/public-paths';
import { isMutating, crossOriginReason } from '@/lib/security/same-origin';

/**
 * Edge middleware — cheap presence gate for authenticated routes. Full session
 * validation (DB lookup, expiry, idle timeout, RBAC) runs in `requireAuth()` on
 * the server. Public paths and assets are skipped by the matcher below.
 */


export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  /*
   * AMH-049 — cross-origin write guard.
   *
   * Runs before anything else and covers API routes as well as pages, which is
   * why the matcher below no longer excludes `/api`. Only requests that carry a
   * session cookie are checked: a cookie is the only credential a browser
   * attaches on its own, so it is the only one that can be used against its
   * owner. Webhooks, the SAML assertion and bearer-token API callers carry no
   * cookie of ours and pass straight through. See lib/security/same-origin.ts.
   */
  if (isMutating(req.method) && req.cookies.has(SESSION_COOKIE)) {
    const reason = crossOriginReason(req, process.env.APP_URL ?? '');
    if (reason) {
      return NextResponse.json(
        { error: 'This request did not come from Ameya OS and was refused.' },
        { status: 403 },
      );
    }
  }

  // The API authenticates per route; middleware only carries the guard above.
  if (pathname.startsWith('/api')) return NextResponse.next();

  if (isPublicPath(pathname)) return NextResponse.next();

  const hasSession = req.cookies.has(SESSION_COOKIE);
  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }
  // Forward the pathname so server layouts can run path-aware guards (e.g. mandatory 2FA).
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-pathname', pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  // `api` is deliberately NOT excluded any more: the cross-origin write guard
  // above has to see API routes, which is where the mutating endpoints are.
  // Static assets stay out — they are never mutating and the matcher is hot.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|offline.html|icons|brand|screenshots|.well-known).*)',
  ],
};
