'use server';
import { revalidatePath } from 'next/cache';
import { ensure, toActionError } from '@/server/actions/_helpers';
import { writeAudit } from '@/lib/audit/log';
import { env } from '@/config/env';
import { automationHealth, type AutomationHealth } from '@/server/services/automation-log';

/**
 * The state of the nightly automation, and a way to run it by hand.
 *
 * Kept separate from `automations.ts`, which is about the rules a person builds
 * themselves. This is the scheduled pass the product runs on its own — the MSME
 * clocks, the demand cycle, the sweeps — and until now there was no way to see
 * whether it had run at all.
 */

export type ScheduledJobsState = AutomationHealth & {
  /**
   * Whether the host is even able to call the endpoint.
   *
   * The cron route fail-closes when `CRON_SECRET` is unset — the right choice
   * for a public machine endpoint, and the reason the whole automation suite
   * can be switched off by one missing environment variable with no symptom
   * other than nothing ever happening. Reported here so the cause is visible
   * rather than deduced.
   */
  cronSecretSet: boolean;
};

export async function getScheduledJobs(): Promise<ScheduledJobsState | { error: string }> {
  try {
    await ensure('admin.setting.manage');
    const health = await automationHealth();
    return { ...health, cronSecretSet: Boolean(env.CRON_SECRET) };
  } catch (e) {
    return toActionError(e);
  }
}

/**
 * Run the nightly pass now.
 *
 * Calls the same code path the scheduler does, in-process — not over HTTP, so
 * it needs no secret and cannot be turned into a way to trigger the job from
 * outside. Permission-gated to the same people who can change settings.
 */
export async function runScheduledJobsNow(): Promise<{ ok: true; summary: string } | { error: string }> {
  try {
    await ensure('admin.setting.manage');
    const now = new Date();

    // Imported lazily: this pulls in every sweep service, and none of it belongs
    // in the bundle of a page that merely displays the last run.
    // `runAndRecordNightlyPass`, not `runNightlyPass` — a hand-run that leaves no
    // trace is exactly the hole this whole panel exists to close. It also means
    // pressing the button clears a "never run" warning honestly, because a run
    // genuinely did happen.
    const { runAndRecordNightlyPass } = await import('@/server/services/nightly-pass');
    const run = await runAndRecordNightlyPass(now);

    const failed = run.steps.filter((s) => !s.ok);
    await writeAudit({
      action: 'UPDATE', entityType: 'Automation',
      summary: `Ran the nightly automation by hand — ${run.steps.length} job(s), ${failed.length} failed`,
    });
    revalidatePath('/admin/automations');

    return {
      ok: true,
      summary: run.truncated
        ? `Stopped after ${(run.ms / 1000).toFixed(1)}s with ${run.skipped.length} job(s) left — they run first next time.`
        : failed.length
          ? `${run.steps.length - failed.length} of ${run.steps.length} jobs completed. Failed: ${failed.map((f) => f.step).join(', ')}.`
          : `All ${run.steps.length} jobs completed in ${(run.ms / 1000).toFixed(1)}s.`,
    };
  } catch (e) {
    return toActionError(e);
  }
}
