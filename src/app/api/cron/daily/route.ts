import { NextResponse, type NextRequest } from 'next/server';
import { requireBearerSecret } from '@/lib/security/require-secret';
import { env } from '@/config/env';
import { runAndRecordNightlyPass } from '@/server/services/nightly-pass';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * The scheduler's entry point. Nothing but auth and a call.
 *
 * The pass itself lives in `nightly-pass.ts` so that the "Run now" button in
 * Admin → Automations executes the identical code. A test button that runs
 * something subtly different from the real schedule tells you nothing about the
 * real schedule, which is worse than having no button at all.
 *
 * NOTE ON `CRON_SECRET`: this fail-closes when the secret is unset — correct for
 * a public machine endpoint, and the single most common reason every automation
 * in the product appears to be dead. Admin → Automations now says so out loud
 * rather than leaving it to be deduced from things not happening.
 */
export async function GET(req: NextRequest) {
  const denied = requireBearerSecret(req, env.CRON_SECRET);
  if (denied) return denied;

  const run = await runAndRecordNightlyPass(new Date());
  return NextResponse.json({ ok: run.steps.every((s) => s.ok) && !run.truncated, ...run });
}
