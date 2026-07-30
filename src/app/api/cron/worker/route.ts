import { NextResponse, type NextRequest } from 'next/server';
import { requireBearerSecret } from '@/lib/security/require-secret';
import { env } from '@/config/env';
import { processPendingWebhooks } from '@/server/services/webhook-worker';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Drains the WebhookEvent queue out-of-band. Guarded by CRON_SECRET. */
export async function GET(req: NextRequest) {
    const denied = requireBearerSecret(req, env.CRON_SECRET);
  if (denied) return denied;
  const result = await processPendingWebhooks(50);
  return NextResponse.json({ ok: true, ...result });
}
