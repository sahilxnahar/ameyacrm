import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { monthKey } from '@/server/services/labour-compliance-service';
import { LabourComplianceView } from '@/components/construction/labour-compliance-view';

export const metadata: Metadata = { title: 'Labour Compliance' };
export const dynamic = 'force-dynamic';

export default async function LabourCompliancePage() {
  await requirePermission('procurement.view');
  const month = monthKey(new Date());
  const vendors = await prisma.vendor.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true, requiresLabourCompliance: true } });
  const labourIds = vendors.filter((v) => v.requiresLabourCompliance).map((v) => v.id);
  const docs = labourIds.length
    ? await prisma.complianceDoc.findMany({ where: { vendorId: { in: labourIds }, periodMonth: month }, select: { id: true, vendorId: true, kind: true, status: true, challanNo: true } })
    : [];

  const statusFor = (vendorId: string, kind: string) => {
    const d = docs.find((x) => x.vendorId === vendorId && x.kind === kind);
    return d ? { id: d.id, status: d.status, challanNo: d.challanNo } : { id: null, status: 'MISSING', challanNo: null };
  };

  const labourVendors = vendors.filter((v) => v.requiresLabourCompliance).map((v) => ({
    id: v.id, name: v.name, epf: statusFor(v.id, 'EPF'), esi: statusFor(v.id, 'ESI'),
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="Labour Compliance" description={`EPF & ESI challans by vendor and month. A flagged labour vendor cannot be paid until the month's challans are verified. Showing ${month}.`} />
      <LabourComplianceView month={month} allVendors={vendors} labourVendors={labourVendors} />
    </div>
  );
}
