import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { renewalDueDate } from '@/lib/legal/trademark';

/**
 * Trademark register engine (module #81). Two out-of-band jobs, run by the daily
 * cron: keep every registered mark's renewalDueOn in sync (registration + 10y),
 * and flip a mark to RENEWAL_DUE once it enters the alert window. No user, no
 * Task row needed — the state transition itself is the alert, surfaced on the
 * IP Registry screen. "Extend, never fork": nothing here touches the spine.
 */
export interface TmSweepResult { backfilled: number; flaggedDue: number }

export async function sweepTrademarkRenewals(now = new Date(), alertDays = 180): Promise<TmSweepResult> {
  let backfilled = 0;
  try {
    // Backfill renewalDueOn for registered marks that are missing it.
    const missing = await prisma.trademark.findMany({
      where: { registeredOn: { not: null }, renewalDueOn: null },
      select: { id: true, registeredOn: true },
      take: 500,
    });
    for (const t of missing) {
      if (!t.registeredOn) continue;
      await prisma.trademark.update({ where: { id: t.id }, data: { renewalDueOn: renewalDueDate(t.registeredOn) } }).catch(() => undefined);
      backfilled++;
    }
  } catch { /* table not migrated yet — skip */ }

  let flaggedDue = 0;
  try {
    const horizon = new Date(now.getTime() + alertDays * 864e5);
    const due = await prisma.trademark.updateMany({
      where: { status: 'REGISTERED', renewalDueOn: { not: null, lte: horizon } },
      data: { status: 'RENEWAL_DUE' },
    });
    flaggedDue = due.count;
  } catch { /* skip */ }

  return { backfilled, flaggedDue };
}
