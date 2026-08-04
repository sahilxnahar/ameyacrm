import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { MsmeTrackerView } from '@/components/finance/msme-tracker-view';

export const metadata: Metadata = { title: 'MSME 45-Day Tracker' };
export const dynamic = 'force-dynamic';

export default async function MsmeTrackerPage() {
  const ctx = await requirePermission('finance.ledger.view');
  const canManage = can(ctx.permissions, 'finance.ledger.manage');
  const [rows, overdue, dueSoon, agg, tracked] = await Promise.all([
    prisma.msmePaymentClock.findMany({ orderBy: [{ status: 'asc' }, { dueDate: 'asc' }], take: 200, include: { vendor: { select: { name: true } } } }).catch(() => []),
    prisma.msmePaymentClock.count({ where: { status: { in: ['OVERDUE', 'DISALLOWED'] } } }).catch(() => 0),
    prisma.msmePaymentClock.count({ where: { status: 'DUE_SOON' } }).catch(() => 0),
    prisma.msmePaymentClock.aggregate({ where: { status: { in: ['ON_TIME', 'DUE_SOON', 'OVERDUE'] } }, _sum: { amount: true } }).catch(() => ({ _sum: { amount: null } })),
    prisma.msmePaymentClock.findMany({ select: { vendorBillId: true } }).catch(() => []),
  ]);

  /*
   * Suppliers, for entering a bill that is not in the system yet.
   *
   * The Udyam number is remembered from whatever was last typed for that
   * supplier rather than stored on the supplier record — it lives on the clock,
   * not on the Vendor, and inventing a column for it would mean a migration for
   * a convenience. Last-used is the right default anyway: it is the number that
   * was on their last bill.
   */
  const vendors = canManage
    ? await prisma.vendor.findMany({
        where: { isActive: true }, orderBy: { name: 'asc' }, take: 500,
        select: { id: true, name: true },
      }).catch(() => [])
    : [];
  const lastUdyam = new Map<string, string>();
  for (const c of [...rows].reverse()) {
    if (c.udyamNo) lastUdyam.set(c.vendorId, c.udyamNo);
  }

  // Bills that could be on a clock and are not. `createMsmeClock` existed and
  // nothing called it, so unless a bill happened to be flagged MSME at the moment
  // it was entered, its 45-day clock could never be started — and this screen sat
  // permanently empty while s.43B(h) ran in the background regardless.
  const onClock = new Set(tracked.map((t) => t.vendorBillId));
  const candidates = canManage
    ? (await prisma.vendorBill.findMany({
        where: { status: { notIn: ['PAID', 'VOID'] }, vendorId: { not: null } },
        orderBy: { billDate: 'desc' }, take: 200,
        select: { id: true, number: true, amount: true, gstAmount: true, billDate: true, vendorId: true, vendor: { select: { name: true } } },
      }).catch(() => []))
        .filter((b) => !onClock.has(b.id))
        .map((b) => ({
          id: b.id, number: b.number, vendorId: b.vendorId!, vendor: b.vendor?.name ?? '—',
          amount: Number(b.amount) + Number(b.gstAmount ?? 0),
          billDate: (b.billDate ?? new Date()).toISOString().slice(0, 10),
        }))
    : [];
  return (
    <div className="space-y-6">
      <PageHeader title="MSME 45-day payment tracker" description="Section 43B(h) of the Income Tax Act disallows a deduction if an MSME supplier isn't paid within 45 days (15 without a written agreement). Every MSME bill runs a live countdown here, flipping to Overdue automatically before it becomes a tax problem." />
      <MsmeTrackerView canManage={canManage} candidates={candidates}
        vendors={vendors.map((v) => ({ id: v.id, name: v.name, udyamNo: lastUdyam.get(v.id) ?? null }))} counts={{ overdue, dueSoon, outstanding: Number(agg._sum.amount ?? 0) }}
        rows={rows.map((c) => ({ id: c.id, vendor: c.vendor?.name ?? '—', udyamNo: c.udyamNo, amount: Number(c.amount), billDate: c.billDate.toISOString(), dueDate: c.dueDate.toISOString(), status: c.status }))} />
    </div>
  );
}
