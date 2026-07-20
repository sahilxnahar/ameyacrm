import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/config/env';
import { runOverdueEscalation } from '@/server/services/escalation-service';
import { runSequences } from '@/server/services/sequence-service';
import { processPending } from '@/server/services/file-sync-service';
import { pruneRateLimits } from '@/lib/security/rate-limit';
import { logError } from '@/lib/monitoring/log-error';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Hourly overdue escalation.
 *
 * Vercel Hobby only permits ONE cron per day, so this endpoint is not in
 * vercel.json — it is meant to be called every hour by an outside scheduler.
 * The Apps Script connector you already run can do it for free; cron-job.org
 * and GitHub Actions work equally well.
 *
 *   GET /api/cron/escalate?key=YOUR_CRON_SECRET
 *
 * Calling it more often than hourly is harmless: the per-item cadence is held
 * in the database, so nobody gets messaged twice.
 */
export async function GET(req: NextRequest) {
  const secret = env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  const key = req.nextUrl.searchParams.get('key');
  if (secret && auth !== `Bearer ${secret}` && key !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const result = await runOverdueEscalation();
    let sequences: unknown = 'skipped';
    try { sequences = await runSequences(); } catch { sequences = 'failed'; }
    let files: unknown = 'skipped';
    try { files = await processPending(); } catch { files = 'failed'; }
    try { await pruneRateLimits(); } catch { /* housekeeping only */ }
    return NextResponse.json({ ok: true, at: new Date().toISOString(), ...result, sequences, files });
  } catch (err) {
    await logError(err, { path: '/api/cron/escalate' });
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : 'failed' }, { status: 500 });
  }
}
