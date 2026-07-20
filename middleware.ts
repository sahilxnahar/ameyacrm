import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth/constants';

/**
 * Edge middleware — cheap presence gate for authenticated routes. Full session
 * validation (DB lookup, expiry, idle timeout, RBAC) runs in `requireAuth()` on
 * the server. Public paths and assets are skipped by the matcher below.
 */
const PUBLIC_PATHS = ['/login', '/signup', '/verify', '/sign', '/install', '/plan', '/two-factor', '/forbidden', '/setup', '/portal', '/pay'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return NextResponse.next();

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
  // Protect everything except Next internals, API routes, and static assets.
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|offline.html|icons|brand|screenshots|.well-known).*)',
  ],
};
