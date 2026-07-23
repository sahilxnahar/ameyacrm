import { NextResponse } from 'next/server';
import { APP_VERSION } from '@/config/changelog';

/**
 * The version of the code currently deployed on the server. The browser boots
 * with the version baked into its bundle; the update banner polls this endpoint
 * and, when the two differ, offers a one-tap reload. Never cached (the service
 * worker also skips /api/*), so it always reflects the live deployment.
 */
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json(
    { version: APP_VERSION },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  );
}
