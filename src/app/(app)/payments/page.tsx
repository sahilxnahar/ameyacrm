import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { getActiveProject, strictProjectScope } from '@/server/services/active-project-service';
import { PaymentsView } from '@/components/payments/payments-view';

export const metadata: Metadata = { title: 'Payments made' };
export const dynamic = 'force-dynamic';

export default async function PaymentsPage() {
  const ctx = await requirePermission('billing.view');
  const active = await getActiveProject(ctx.user.id);
  const scope = strictProjectScope(active.id);

  const rows = await prisma.voucher.findMany({
    where: { kind: { in: ['CASH_PAID', 'BANK_PAID'] }, ...scope },
    orderBy: [{ paidOn: 'desc' }, { voucherDate: 'desc' }, { number: 'desc' }],
    take: 1000,
    select: {
      id: true, number: true, kind: true, status: true, partyName: true, amount: true,
      mode: true, utr: true, paidOn: true, voucherDate: true, bankName: true,
      reference: true, narration: true,
    },
  });

  const payments = rows.map((r) => ({
    id: r.id, number: r.number, kind: r.kind, status: r.status,
    partyName: r.partyName, amount: Number(r.amount), mode: r.mode,
    utr: r.utr, bankName: r.bankName, reference: r.reference, narration: r.narration,
    paidOn: (r.paidOn ?? r.voucherDate).toISOString(),
    dated: r.voucherDate.toISOString(),
  }));

  const live = payments.filter((p) => p.status !== 'CANCELLED');
  const missingUtr = live.filter((p) => !p.utr && p.mode !== 'CASH').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments made"
        description={`Everyone you have paid, when, and the UTR against each one. ${active.name}.`}
      />
      <PaymentsView
        payments={payments}
        totalPaid={live.reduce((s, p) => s + p.amount, 0)}
        missingUtr={missingUtr}
      />
    </div>
  );
}
