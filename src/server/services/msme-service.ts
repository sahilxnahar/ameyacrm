import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { env } from '@/config/env';

/**
 * MSME 45-day payment clock (module #53, S.43B(h)). Maintains the live status of
 * every open MSME vendor bill and answers the gate question — an OVERDUE MSME due
 * is a tax-disallowance risk, surfaced at payment time. Non-stop safe: pure DB,
 * wrapped in try/catch by the cron step() so a failure never stalls the loop.
 */
export interface MsmeSweep { overdue: number; dueSoon: number }

export async function sweepMsmeClocks(now = new Date()): Promise<MsmeSweep> {
  const alertDays = Number(env.MSME_ALERT_DAYS ?? 7);
  const soon = new Date(now.getTime() + alertDays * 864e5);
  let overdue = 0, dueSoon = 0;
  try {
    const o = await prisma.msmePaymentClock.updateMany({ where: { status: { in: ['ON_TIME', 'DUE_SOON'] }, dueDate: { lt: now } }, data: { status: 'OVERDUE' } });
    overdue = o.count;
    const d = await prisma.msmePaymentClock.updateMany({ where: { status: 'ON_TIME', dueDate: { gte: now, lte: soon } }, data: { status: 'DUE_SOON' } });
    dueSoon = d.count;
  } catch { /* table not migrated — skip */ }
  return { overdue, dueSoon };
}

/** Statutory due date: 45 days with a written agreement, else 15 (S.15 MSMED Act). */
export function msmeDueDate(billDate: Date, hasAgreement = true): Date {
  const days = hasAgreement ? Number(env.MSME_DEFAULT_DUE_DAYS ?? 45) : 15;
  return new Date(billDate.getTime() + days * 864e5);
}

/** Gate helper: is there an overdue MSME due on this vendor? (advisory at payment) */
export async function vendorMsmeOverdue(vendorId: string): Promise<{ overdue: boolean; count: number }> {
  try {
    const count = await prisma.msmePaymentClock.count({ where: { vendorId, status: { in: ['OVERDUE', 'DISALLOWED'] } } });
    return { overdue: count > 0, count };
  } catch {
    return { overdue: false, count: 0 };
  }
}

/**
 * Stop the clock when the bill is actually paid.
 *
 * Nothing wrote `PAID` — the status and `paidVoucherId` both existed and were
 * dead. So a bill settled inside the 45 days still flipped to OVERDUE on day 46
 * and stayed there for ever: the tracker's exposure total permanently included
 * bills that were paid, every future RA settlement for that vendor carried a
 * s.43B(h) warning that was not true, and the command-centre counter only ever
 * went up. Within a quarter the tracker is noise, which is exactly when a real
 * overdue appears and nobody looks.
 *
 * Best-effort: never fail a payment because a tracker could not be updated.
 */
export async function closeMsmeClockForBill(vendorBillId: string, voucherId: string | null): Promise<void> {
  try {
    await prisma.msmePaymentClock.updateMany({
      where: { vendorBillId, status: { not: 'PAID' } },
      data: { status: 'PAID', paidVoucherId: voucherId },
    });
  } catch { /* the payment stands */ }
}

/** Re-open it if that payment is withdrawn — the bill is unpaid again. */
export async function reopenMsmeClockForBill(vendorBillId: string, now = new Date()): Promise<void> {
  try {
    const row = await prisma.msmePaymentClock.findUnique({ where: { vendorBillId }, select: { dueDate: true } });
    if (!row) return;
    await prisma.msmePaymentClock.update({
      where: { vendorBillId },
      data: {
        status: row.dueDate < now ? 'OVERDUE' : 'ON_TIME',
        paidVoucherId: null,
      },
    });
  } catch { /* the cancellation stands */ }
}
