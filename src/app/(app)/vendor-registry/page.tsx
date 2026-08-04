import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { VendorRegistryView } from '@/components/legal/vendor-registry-view';
import { ListNotice } from '@/components/ui/list-notice';
import { listWindow, listMeta } from '@/lib/list/page-window';

export const metadata: Metadata = { title: 'Sub-Contractor Registry' };
export const dynamic = 'force-dynamic';

export default async function VendorRegistryPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePermission('procurement.view');
  const win = listWindow(await searchParams, 300);
  const [rows, defaultTotal, vendors, blacklisted] = await Promise.all([
    prisma.vendorDefault.findMany({ orderBy: { reportedOn: 'desc' }, take: win.take, include: { vendor: { select: { name: true, isActive: true } }, } }).catch(() => []),
    prisma.vendorDefault.count().catch(() => 0),
    prisma.vendor.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }).catch(() => []),
    prisma.vendorDefault.count({ where: { severity: 'BLACKLIST' } }).catch(() => 0),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title="Sub-contractor default registry" description="A cross-project record of vendor defaults — site abandonment, QA failures, delays, safety lapses. Flagging a vendor as blacklisted deactivates them everywhere at once, so a bad actor on one site can't quietly be engaged on another." />
      <VendorRegistryView vendors={vendors} counts={{ blacklisted, total: defaultTotal }}
        rows={rows.map((d) => ({ id: d.id, vendor: d.vendor?.name ?? '—', vendorActive: d.vendor?.isActive ?? true, kind: d.kind, severity: d.severity, note: d.note, reportedOn: d.reportedOn.toISOString() }))} />
      <ListNotice meta={listMeta(rows.length, defaultTotal, win)} noun="recorded defaults" />
    </div>
  );
}
