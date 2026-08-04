import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { notify } from '@/lib/notifications/notify';
import { putObject } from '@/lib/storage/storage';
import { releaseExpiredHolds } from '@/lib/inventory/auto-release';
import { writeAudit } from '@/lib/audit/log';
import { getBriefing } from '@/server/services/briefing-service';
import { runOverdueEscalation } from '@/server/services/escalation-service';
import { runOnboardingReminders } from '@/server/services/onboarding-service';
import { runChatNudges } from '@/server/services/chat-nudge-service';
import { runTaskDigests } from '@/server/services/task-digest-service';
import { processPendingWebhooks } from '@/server/services/webhook-worker';
import { runDemandCycle } from '@/server/services/demand-service';
import { sweepTrademarkRenewals } from '@/server/services/trademark-service';
import { sweepStructuralContracts } from '@/server/services/structural-contract-service';
import { sweepVendorInsolvency } from '@/server/services/insolvency-service';
import { sweepLegalDeadlines } from '@/server/services/legal-sweeps';
import { sweepMsmeClocks } from '@/server/services/msme-service';
import { reconcileGstr2b } from '@/server/services/gstr-service';
import { runPersonalAutomations } from '@/server/services/personal-automation-service';
import { runRetentionSweep, rotateBackups } from '@/server/services/retention-service';
import { run2faNudges } from '@/server/services/twofa-nudge-service';
import { runWithBudget, recordRun, type AutomationRun } from '@/server/services/automation-log';

/**
 * The host kills the function at its limit, and a killed function writes
 * nothing — you lose the work AND any record of how far it got. Stopping
 * voluntarily a few seconds early leaves room to write the log, so a run that
 * ran out of time still names exactly which jobs it skipped.
 */
export const BUDGET_MS = 52_000;

/**
 * The nightly maintenance pass — every scheduled job, in one place.
 *
 * Lives in a service rather than inside the route so that the "Run now" button
 * in Admin exercises the identical code path. A test button that runs something
 * subtly different from the real schedule tells you nothing about the real
 * schedule, which is worse than having no button.
 *
 * ── Order is load-bearing ───────────────────────────────────────────────────
 *
 * The jobs used to run in the order they happened to be written, which put the
 * whole-database backup and the AI briefing — comfortably the two slowest — at
 * positions 4 and 5, ahead of every statutory sweep. On a slow night the
 * function hit its 60-second limit partway down and the MSME 45-day clocks, the
 * demand cycle and the GSTR reconciliation simply did not run. Nothing failed;
 * they were never reached, and nothing recorded that.
 *
 * The order is now: things with a legal deadline first, things people are
 * waiting on second, expensive housekeeping last. If the budget runs out, what
 * is lost is a backup that can be taken again — not a s.43B(h) clock that
 * quietly stopped ticking.
 */
export async function runNightlyPass(now = new Date()): Promise<AutomationRun> {
  return runWithBudget([
    // ── Statutory clocks. A missed day here costs money or a deduction. ──
    { step: 'MSME 45-day clocks', run: () => sweepMsmeClocks(now) },
    { step: 'Legal deadlines', run: () => sweepLegalDeadlines(now) },
    { step: 'Trademark renewals', run: () => sweepTrademarkRenewals(now) },
    { step: 'Structural contracts', run: () => sweepStructuralContracts(now) },
    { step: 'Vendor insolvency', run: () => sweepVendorInsolvency() },

    // ── Money owed, in and out. ──
    { step: 'Payment demands', run: () => runDemandCycle() },
    { step: 'Overdue payments', run: () => flagOverduePayments(now) },
    {
      step: 'Payment reminders',
      run: async () => {
        const { runPartyReminders } = await import('@/server/services/party-reminder-service');
        return runPartyReminders(now);
      },
    },
    { step: 'GSTR-2B reconciliation', run: () => reconcileGstr2b() },

    // ── Things a person is waiting on. ──
    { step: 'Unit holds released', run: () => releaseExpiredHolds() },
    { step: 'Reminders fired', run: () => fireDueReminders(now) },
    { step: 'Approval escalation', run: () => runOverdueEscalation() },
    { step: 'Task digests', run: () => runTaskDigests(now) },
    { step: 'My Automations', run: () => runPersonalAutomations(now) },
    { step: 'Webhook queue', run: () => processPendingWebhooks(100) },

    // ── Nudges. Useful, but nothing breaks if they wait a day. ──
    { step: 'Onboarding reminders', run: () => runOnboardingReminders(now) },
    { step: 'Chat nudges', run: () => runChatNudges(now) },
    { step: 'Two-factor nudges', run: () => run2faNudges(now) },

    // ── Housekeeping. Slowest, and the safest thing to lose. ──
    { step: 'Retention sweep', run: () => runRetentionSweep(now) },
    {
      step: 'Guest sandboxes',
      run: async () => {
        // The recycle bin is a window, not an archive — 72 hours, then gone.
        const { pruneDeletedRecords } = await import('@/server/services/undo-service');
        await pruneDeletedRecords(now).catch(() => 0);
        const { pruneExpiredSandboxes } = await import('@/server/services/sandbox-service');
        return pruneExpiredSandboxes();
      },
    },
    {
      step: 'Daily briefing',
      run: async () => {
        const b = await getBriefing(true);
        return b.cached ? 'generated' : 'skipped';
      },
    },
    { step: 'Nightly backup', run: () => takeBackup(now) },
  ], BUDGET_MS, now);
}

/** Run the pass and record the outcome. What the scheduler calls. */
export async function runAndRecordNightlyPass(now = new Date()): Promise<AutomationRun> {
  const run = await runNightlyPass(now);
  await recordRun(run);
  return run;
}

/** Flag overdue milestones, accrue notional interest, and nudge the rep. */
async function flagOverduePayments(now: Date) {
  const flagged = await prisma.paymentMilestone.updateMany({
    where: { status: { in: ['PENDING', 'PARTIAL'] }, dueDate: { lt: now } },
    data: { status: 'OVERDUE' },
  });
  const rate = Number((await prisma.setting.findUnique({ where: { key: 'collections.interestPct' } }))?.value ?? 18) || 18;
  const overdue = await prisma.paymentMilestone.findMany({
    where: { status: 'OVERDUE' }, include: { booking: { select: { salesRepId: true } } }, take: 1000,
  });
  const byRep = new Map<string, { count: number; amount: number; interest: number }>();
  for (const m of overdue) {
    const days = m.dueDate ? Math.max(0, Math.floor((now.getTime() - m.dueDate.getTime()) / 86400000)) : 0;
    const interest = Number(m.amount) * (rate / 100) * (days / 365);
    const rep = m.booking?.salesRepId;
    if (rep) {
      const e = byRep.get(rep) ?? { count: 0, amount: 0, interest: 0 };
      e.count++; e.amount += Number(m.amount); e.interest += interest;
      byRep.set(rep, e);
    }
  }
  const fmt = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
  for (const [rep, e] of byRep) {
    await notify({
      userId: rep, type: 'SYSTEM',
      title: `${e.count} overdue payment(s) need follow-up`,
      body: `Rs.${fmt.format(e.amount)} overdue · ~Rs.${fmt.format(e.interest)} interest at ${rate}% p.a.`,
      link: '/billing',
    });
  }
  return { flagged: flagged.count, repsNotified: byRep.size };
}

/** Send every reminder that has come due and mark it notified. */
async function fireDueReminders(now: Date) {
  const due = await prisma.reminder.findMany({
    where: { status: 'PENDING', notifiedAt: null, dueAt: { lte: now } }, take: 500,
  });
  let sent = 0;
  for (const r of due) {
    try {
      await notify({
        userId: r.userId, type: 'SYSTEM', title: `Reminder: ${r.title}`,
        body: r.notes ?? undefined, link: r.leadId ? `/sales/${r.leadId}` : '/reminders',
      });
      await prisma.reminder.update({ where: { id: r.id }, data: { notifiedAt: new Date() } });
      sent++;
    } catch { /* one bad reminder must not stop the rest */ }
  }
  return { sent, due: due.length };
}

/**
 * The nightly snapshot, plus retention roll-off.
 *
 * This used to build its own bundle and write it as PLAIN TEXT JSON under a
 * date-derived key, while a second, encrypted implementation sat unscheduled in
 * /api/cron/backup. Both now call the same code — see backup-service.ts for
 * what was wrong with the old one and why.
 */
async function takeBackup(now: Date) {
  const { takeEncryptedBackup } = await import('@/server/services/backup-service');
  const result = await takeEncryptedBackup(now);
  await rotateBackups(now).catch(() => undefined);
  return result;
}
