import type { Metadata } from 'next';
import { startOfMonth, endOfMonth } from 'date-fns';
import { requirePermission } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { getActiveProject, projectScope } from '@/server/services/active-project-service';
import { CashBookView } from '@/components/cashbook/cash-book-view';

export const metadata: Metadata = { title: 'Cash book' };
export const dynamic = 'force-dynamic';

export default async function CashBookPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const ctx = await requirePermission('finance.ledger.view');
  const { m } = await searchParams;
  const base = m ? new Date(`${m}-01T00:00:00`) : new Date();
  const from = startOfMonth(base);
  const to = endOfMonth(base);

  const active = await getActiveProject(ctx.user.id);
  // Include payments not tagged to any project so nothing hides under a project.
  const scope = projectScope(active.id);

  const [vouchers, projects, openingRows] = await Promise.all([
    prisma.voucher.findMany({
      where: { voucherDate: { gte: from, lte: to }, ...scope },
      orderBy: [{ voucherDate: 'desc' }, { number: 'desc' }],
      take: 500,
    }),
    prisma.project.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    // Everything before this month, to work out what the book opened with.
    prisma.voucher.findMany({
      where: { voucherDate: { lt: from }, status: 'POSTED', ...scope },
      select: { kind: true, amount: true },
    }),
  ]);

  const IN = new Set(['CASH_RECEIVED', 'BANK_RECEIVED']);
  const OUT = new Set(['CASH_PAID', 'BANK_PAID']);
  const opening = openingRows.reduce((n, v) => n + (IN.has(v.kind) ? Number(v.amount) : OUT.has(v.kind) ? -Number(v.amount) : 0), 0);

  return (
    <div>
      <PageHeader
        title="Cash book"
        description="Every rupee and every load of material that moves, as a numbered voucher."
      />
      <CashBookView
        month={`${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}`}
        opening={opening}
        projects={projects}
        activeProjectId={active.id}
        canManage={can(ctx.permissions, 'billing.invoice.manage')}
        vouchers={vouchers.map((v) => ({
          id: v.id, number: v.number, kind: v.kind, status: v.status,
          date: v.voucherDate.toISOString(),
          partyName: v.partyName,
          amount: Number(v.amount),
          mode: v.mode,
          reference: v.reference,
          narration: v.narration,
          materialName: v.materialName,
          quantity: v.quantity === null ? null : Number(v.quantity),
          unit: v.unit,
          cancelReason: v.cancelReason,
        }))}
      />
    </div>
  );
}
