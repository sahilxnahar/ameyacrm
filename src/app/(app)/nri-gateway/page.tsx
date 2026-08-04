import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { ListNotice } from '@/components/ui/list-notice';
import { listWindow, listMeta } from '@/lib/list/page-window';
import { NriGatewayView } from '@/components/legal/nri-gateway-view';

export const metadata: Metadata = { title: 'NRI / FEMA Gateway' };
export const dynamic = 'force-dynamic';

export default async function NriGatewayPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePermission('booking.view');
  const win = listWindow(await searchParams, 200);
  const [rows, nriComplianceProfileTotal, verified, femaDue] = await Promise.all([
    prisma.nriComplianceProfile.findMany({ orderBy: { createdAt: 'desc' }, take: win.take, include: { remittances: { orderBy: { receivedOn: 'desc' } } } }).catch(() => []),
    prisma.nriComplianceProfile.count().catch(() => 0),
    prisma.nriComplianceProfile.count({ where: { status: 'VERIFIED' } }).catch(() => 0),
    prisma.foreignRemittance.count({ where: { reportedOn: null, reportDueOn: { not: null, lte: new Date(Date.now() + 30 * 864e5) } } }).catch(() => 0),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title="Cross-border legal & NRI KYC gateway" description="FATCA declarations and FEMA documentation for foreign buyers. Each inward remittance is logged with its 90-day FEMA reporting deadline, so an NRE/NRO collection is never reported late." />
      <NriGatewayView counts={{ total: nriComplianceProfileTotal, verified, femaDue }}
        rows={rows.map((p) => ({
          id: p.id, taxResidency: p.taxResidency, status: p.status, femaCategory: p.femaCategory,
          fatcaDeclared: p.fatcaDeclared, fatcaFormRef: p.fatcaFormRef,
          remittances: p.remittances.map((r) => ({ id: r.id, amountForeign: Number(r.amountForeign), currency: r.currency, amountInr: Number(r.amountInr), receivedOn: r.receivedOn?.toISOString() ?? null, reportDueOn: r.reportDueOn?.toISOString() ?? null, reportedOn: r.reportedOn?.toISOString() ?? null })),
        }))} />
      <ListNotice meta={listMeta(rows.length, nriComplianceProfileTotal, win)} noun="NRI profiles" />
    </div>
  );
}
