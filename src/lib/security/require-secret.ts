import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { safeEqual } from '@/lib/utils/crypto';

/**
 * Fail-CLOSED shared-secret guard for machine endpoints (cron, ingest, webhooks).
 * Fixes the v15.87 fail-open findings (F-03/F-04/F-31/F-33):
 *  - secret unset  -> DENY (503), never silently open;
 *  - read from the Authorization: Bearer header only (no ?key= query leakage);
 *  - constant-time comparison.
 * Returns null when authorized, or a NextResponse to return immediately.
 */
export function requireBearerSecret(req: NextRequest, secret: string | undefined | null): NextResponse | null {
  if (!secret) return NextResponse.json({ error: 'endpoint not configured' }, { status: 503 });
  const header = req.headers.get('authorization') ?? '';
  if (!safeEqual(header, `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return null;
}

/** Bare-secret variant via a custom header (x-ingest-key, x-telephony-key, ...). */
export function requireHeaderSecret(req: NextRequest, headerName: string, secret: string | undefined | null): NextResponse | null {
  if (!secret) return NextResponse.json({ error: 'endpoint not configured' }, { status: 503 });
  const provided = req.headers.get(headerName) ?? '';
  if (!provided || !safeEqual(provided, secret)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return null;
}
