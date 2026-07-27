import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { WelfareLogView } from '@/components/legal/welfare-log-view';
import { getWelfareCompliance } from '@/server/services/welfare-service';

export const metadata: Metadata = { title: 'BOCW Welfare Log' };
export const dynamic = 'force-dynamic';

export default async function WelfareLogPage() {
  await requirePermission('procurement.view');
  const [rows, projects, compliance] = await Promise.all([
    prisma.welfareLog.findMany({ orderBy: { loggedOn: 'desc' }, take: 200, include: { project: { select: { name: true } } } }).catch(() => []),
    prisma.project.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }).catch(() => []),
    getWelfareCompliance(),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title="BOCW Labour Camp & Creche Welfare Log" description="Statutory-audit evidence under the BOCW Act — drinking water, medical camps, creche and sanitation, logged with headcount and photos. Any required facility not logged this month shows as a compliance gap, so a labour inspection never finds a surprise." />
      <WelfareLogView projects={projects} gaps={compliance.gaps} gapCount={compliance.gapCount}
        rows={rows.map((w) => ({ id: w.id, project: w.project?.name ?? '—', category: w.category, headcount: w.headcount, note: w.note, loggedOn: w.loggedOn.toISOString() }))} />
    </div>
  );
}
