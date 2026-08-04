import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { LandConversionView } from '@/components/legal/land-conversion-view';

export const metadata: Metadata = { title: 'Land Conversion (ALN)' };
export const dynamic = 'force-dynamic';

export default async function LandConversionPage() {
  await requirePermission('land.view');
  const [rows, projects, done] = await Promise.all([
    prisma.landConversion.findMany({ orderBy: { createdAt: 'desc' }, take: 200, include: { project: { select: { name: true } } } }).catch(() => []),
    prisma.project.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }).catch(() => []),
    prisma.landConversion.count({ where: { stage: { in: ['DC_ORDER_ISSUED', 'KHATA_UPDATED'] } } }).catch(() => 0),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title="Land conversion & ALN tracker" description="The agricultural-to-residential conversion workflow — RTC verification, DC scrutiny, the conversion fine, and the DC alienation order — tracked stage by stage so no parcel is built on before it is legally converted." />
      <LandConversionView projects={projects} counts={{ done, total: rows.length }}
        rows={rows.map((c) => ({ id: c.id, surveyNo: c.surveyNo, village: c.village, taluk: c.taluk, stage: c.stage, extentAcres: c.extentAcres != null ? Number(c.extentAcres) : null, dcOrderNo: c.dcOrderNo, conversionFee: c.conversionFee != null ? Number(c.conversionFee) : null, appliedOn: c.appliedOn?.toISOString() ?? null, orderOn: c.orderOn?.toISOString() ?? null, project: c.project?.name ?? null }))} />
    </div>
  );
}
