import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/config/env';
import { processPendingWebhooks } from '@/server/services/webhook-worker';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Drains the WebhookEvent queue out-of-band. Guarded by CRON_SECRET. */
export async function GET(req: NextRequest) {
  const secret = env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  const key = req.nextUrl.searchParams.get('key');
  if (secret && auth !== `Bearer ${secret}` && key !== secret) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const result = await processPendingWebhooks(50);
  return NextResponse.json({ ok: true, ...result });
}
