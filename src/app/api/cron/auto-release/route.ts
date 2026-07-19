import { NextResponse, type NextRequest } from 'next/server';
import { releaseExpiredHolds } from '@/lib/inventory/auto-release';
import { env } from '@/config/env';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/** Vercel Cron → releases expired unit holds. Auth: `Authorization: Bearer <CRON_SECRET>` or `?key=<CRON_SECRET>`. */
export async function GET(req: NextRequest) {
  const secret = env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  const key = req.nextUrl.searchParams.get('key');
  if (secret && auth !== `Bearer ${secret}` && key !== secret) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const released = await releaseExpiredHolds();
  return NextResponse.json({ ok: true, released, at: new Date().toISOString() });
}
