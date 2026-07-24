import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { RecurringView } from '@/components/finance/recurring-view';

export const metadata: Metadata = { title: 'Recurring Payments' };
export const dynamic = 'force-dynamic';

export default async function RecurringPage() {
  const ctx = await requirePermission('finance.ledger.view');
  const rows = await prisma.recurringPayment.findMany({ orderBy: [{ isActive: 'desc' }, { nextDue: 'asc' }] });

  return (
    <div>
      <PageHeader
        title="Recurring Payments"
        description="Salaries, rent, EMIs, subscriptions — set them once and record each one on time. The CRM reminds you; it never pays anything itself."
      />
      <RecurringView
        canManage={can(ctx.permissions, 'billing.bill.manage')}
        rows={rows.map((r) => ({
          id: r.id, payeeName: r.payeeName, amount: Number(r.amount), frequency: r.frequency,
          nextDue: r.nextDue.toISOString(), category: r.accountCode, mode: r.mode, note: r.note,
          isActive: r.isActive, lastPaidAt: r.lastPaidAt?.toISOString() ?? null,
        }))}
      />
    </div>
  );
}
