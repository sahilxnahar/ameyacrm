import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { RevenueRecognitionView } from '@/components/finance/revenue-recognition-view';

export const metadata: Metadata = { title: 'Revenue Recognition (POCM)' };
export const dynamic = 'force-dynamic';

export default async function RevenueRecognitionPage() {
  await requirePermission('finance.ledger.view');
  const [rows, projects] = await Promise.all([
    prisma.revenueRecognition.findMany({ orderBy: [{ period: 'desc' }], take: 200, include: { project: { select: { name: true } } } }).catch(() => []),
    prisma.project.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }).catch(() => []),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title="IND-AS 115 Revenue Recognition (POCM)" description="Recognise project revenue on the Percentage-of-Completion Method — cost incurred over total estimated cost, applied to the contract value. Snapshot a period and the cumulative and incremental revenue are computed for you, never over-recognising past 100%." />
      <RevenueRecognitionView projects={projects}
        rows={rows.map((r) => ({ id: r.id, project: r.project?.name ?? '—', period: r.period, pocmPercent: Number(r.pocmPercent), revenueToDate: Number(r.revenueToDate), revenueThisPeriod: Number(r.revenueThisPeriod), costToDate: Number(r.costToDate), totalEstCost: Number(r.totalEstCost) }))} />
    </div>
  );
}
