import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { ListNotice } from '@/components/ui/list-notice';
import { listWindow, listMeta } from '@/lib/list/page-window';
import { VendorInsolvencyView } from '@/components/legal/vendor-insolvency-view';

export const metadata: Metadata = { title: 'Vendor Insolvency (NCLT)' };
export const dynamic = 'force-dynamic';

export default async function VendorInsolvencyPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePermission('finance.ledger.view');
  const win = listWindow(await searchParams, 200);
  const [rows, vendorInsolvencyCaseTotal, vendors, frozen] = await Promise.all([
    prisma.vendorInsolvencyCase.findMany({ orderBy: { createdAt: 'desc' }, take: win.take, include: { vendor: { select: { name: true, isActive: true } } } }).catch(() => []),
    prisma.vendorInsolvencyCase.count().catch(() => 0),
    prisma.vendor.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }).catch(() => []),
    prisma.vendorInsolvencyCase.count({ where: { stage: { in: ['CIRP_ADMITTED', 'MORATORIUM'] }, freezeAdvances: true } }).catch(() => 0),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title="Vendor insolvency monitor (NCLT / IBC)" description="Flag a vendor pulled into IBC proceedings. A vendor in CIRP or under a s.14 moratorium is frozen — the RA-bill settlement refuses their advances automatically until the flag clears." />
      <VendorInsolvencyView
        vendors={vendors}
        counts={{ frozen, total: vendorInsolvencyCaseTotal }}
        rows={rows.map((c) => ({
          id: c.id, vendor: c.vendor?.name ?? '—', vendorActive: c.vendor?.isActive ?? true, stage: c.stage,
          cirpRef: c.cirpRef, irpName: c.irpName, ncltBench: c.ncltBench,
          admittedOn: c.admittedOn?.toISOString() ?? null, freezeAdvances: c.freezeAdvances,
          claimFiledInr: c.claimFiledInr != null ? Number(c.claimFiledInr) : null,
        }))}
      />
      <ListNotice meta={listMeta(rows.length, vendorInsolvencyCaseTotal, win)} noun="insolvency cases" />
    </div>
  );
}
