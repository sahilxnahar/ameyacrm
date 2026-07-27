import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { VendorRegistryView } from '@/components/legal/vendor-registry-view';

export const metadata: Metadata = { title: 'Sub-Contractor Registry' };
export const dynamic = 'force-dynamic';

export default async function VendorRegistryPage() {
  await requirePermission('procurement.view');
  const [rows, vendors, blacklisted] = await Promise.all([
    prisma.vendorDefault.findMany({ orderBy: { reportedOn: 'desc' }, take: 300, include: { vendor: { select: { name: true, isActive: true } }, } }).catch(() => []),
    prisma.vendor.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }).catch(() => []),
    prisma.vendorDefault.count({ where: { severity: 'BLACKLIST' } }).catch(() => 0),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title="Sub-Contractor Default Registry" description="A cross-project record of vendor defaults — site abandonment, QA failures, delays, safety lapses. Flagging a vendor as blacklisted deactivates them everywhere at once, so a bad actor on one site can't quietly be engaged on another." />
      <VendorRegistryView vendors={vendors} counts={{ blacklisted, total: rows.length }}
        rows={rows.map((d) => ({ id: d.id, vendor: d.vendor?.name ?? '—', vendorActive: d.vendor?.isActive ?? true, kind: d.kind, severity: d.severity, note: d.note, reportedOn: d.reportedOn.toISOString() }))} />
    </div>
  );
}
