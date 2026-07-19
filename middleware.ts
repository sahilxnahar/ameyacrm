import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth/constants';

/**
 * Edge middleware — cheap presence gate for authenticated routes. Full session
 * validation (DB lookup, expiry, idle timeout, RBAC) runs in `requireAuth()` on
 * the server. Public paths and assets are skipped by the matcher below.
 */
const PUBLIC_PATHS = ['/login', '/two-factor', '/forbidden'];

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
  return NextResponse.next();
}

export const config = {
  // Protect everything except Next internals, API routes, and static assets.
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|offline.html|icons|brand|.well-known).*)',
  ],
};
