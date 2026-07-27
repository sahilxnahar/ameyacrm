import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { MsmeTrackerView } from '@/components/finance/msme-tracker-view';

export const metadata: Metadata = { title: 'MSME 45-Day Tracker' };
export const dynamic = 'force-dynamic';

export default async function MsmeTrackerPage() {
  await requirePermission('finance.ledger.view');
  const [rows, overdue, dueSoon, agg] = await Promise.all([
    prisma.msmePaymentClock.findMany({ orderBy: [{ status: 'asc' }, { dueDate: 'asc' }], take: 200, include: { vendor: { select: { name: true } } } }).catch(() => []),
    prisma.msmePaymentClock.count({ where: { status: { in: ['OVERDUE', 'DISALLOWED'] } } }).catch(() => 0),
    prisma.msmePaymentClock.count({ where: { status: 'DUE_SOON' } }).catch(() => 0),
    prisma.msmePaymentClock.aggregate({ where: { status: { in: ['ON_TIME', 'DUE_SOON', 'OVERDUE'] } }, _sum: { amount: true } }).catch(() => ({ _sum: { amount: null } })),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title="MSME 45-Day Payment Tracker" description="Section 43B(h) of the Income Tax Act disallows a deduction if an MSME supplier isn't paid within 45 days (15 without a written agreement). Every MSME bill runs a live countdown here, flipping to Overdue automatically before it becomes a tax problem." />
      <MsmeTrackerView counts={{ overdue, dueSoon, outstanding: Number(agg._sum.amount ?? 0) }}
        rows={rows.map((c) => ({ id: c.id, vendor: c.vendor?.name ?? '—', udyamNo: c.udyamNo, amount: Number(c.amount), billDate: c.billDate.toISOString(), dueDate: c.dueDate.toISOString(), status: c.status }))} />
    </div>
  );
}
