import { NextResponse, type NextRequest } from 'next/server';
import { requireBearerSecret } from '@/lib/security/require-secret';
import { releaseExpiredHolds } from '@/lib/inventory/auto-release';
import { env } from '@/config/env';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/** Vercel Cron → releases expired unit holds. Auth: `Authorization: Bearer <CRON_SECRET>` or `?key=<CRON_SECRET>`. */
export async function GET(req: NextRequest) {
    const denied = requireBearerSecret(req, env.CRON_SECRET);
  if (denied) return denied;
  const released = await releaseExpiredHolds();
  return NextResponse.json({ ok: true, released, at: new Date().toISOString() });
}
