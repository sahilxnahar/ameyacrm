import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { RaBillsView } from '@/components/construction/ra-bills-view';
import { ListNotice } from '@/components/ui/list-notice';
import { listWindow, listMeta } from '@/lib/list/page-window';

export const metadata: Metadata = { title: 'RA Bills' };
export const dynamic = 'force-dynamic';

export default async function RaBillsPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requirePermission('procurement.view');
  const win = listWindow(await searchParams, 200);
  const [bills, billTotal, vendors, projects, approvers] = await Promise.all([
    prisma.raBill.findMany({ orderBy: { createdAt: 'desc' }, take: win.take, include: { _count: { select: { lines: true } } } }),
    prisma.raBill.count(),
    prisma.vendor.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.project.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { status: 'ACTIVE', role: { in: ['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD', 'MANAGER'] } }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);

  const vName = new Map(vendors.map((v) => [v.id, v.name]));
  const num = (x: unknown) => Number(x ?? 0);

  const summary = {
    pendingCount: bills.filter((b) => b.status === 'PENDING').length,
    certifiedUnpaid: bills.filter((b) => b.status === 'CERTIFIED').reduce((s, b) => s + num(b.netPayable), 0),
    cessAccrued: bills.filter((b) => b.status !== 'REJECTED' && b.status !== 'DRAFT').reduce((s, b) => s + num(b.cessAmount), 0),
    retentionHeld: bills.filter((b) => b.status === 'PAID' || b.status === 'CERTIFIED').reduce((s, b) => s + num(b.retentionAmount), 0),
  };

  return (
    <div className="space-y-6">
      <PageHeader title="RA bills" description="Contractor running-account bills — certified by the Independent Engineer, with 1% BOCW cess, retention and TDS worked out automatically and settled with one click." />
      <RaBillsView
        canManage={can(ctx.permissions, 'procurement.manage')}
        canPay={can(ctx.permissions, 'finance.ledger.manage')}
        vendors={vendors}
        projects={projects}
        approvers={approvers}
        summary={summary}
        bills={bills.map((b) => ({
          id: b.id, number: b.number, status: b.status, vendorName: b.vendorId ? vName.get(b.vendorId) ?? '—' : (b.narration ? 'Contractor' : '—'),
          gross: num(b.grossValue), cess: num(b.cessAmount), retention: num(b.retentionAmount), tds: num(b.tdsAmount),
          tdsSection: b.tdsSection, net: num(b.netPayable), lines: b._count.lines, createdAt: b.createdAt.toISOString(),
        }))}
      />
      {/* The RA-bill summary tiles above are computed from `bills` — the rows on
          this page, not the whole table. That is fine while the list is
          complete and misleading the moment it is not, so say which it is. */}
      <ListNotice meta={listMeta(bills.length, billTotal, win)} noun="RA bills" />
    </div>
  );
}
