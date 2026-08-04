import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { PlanSanctionView } from '@/components/legal/plan-sanction-view';
import { ocRisk } from '@/lib/planning/far';

export const metadata: Metadata = { title: 'Plan Sanction & FAR' };
export const dynamic = 'force-dynamic';

export default async function PlanSanctionPage() {
  await requirePermission('land.view');
  const [rows, projects] = await Promise.all([
    prisma.planSanction.findMany({ orderBy: { createdAt: 'desc' }, take: 200, include: { project: { select: { name: true } } } }).catch(() => []),
    prisma.project.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }).catch(() => []),
  ]);
  const mapped = rows.map((s) => ({
    id: s.id, project: s.project?.name ?? '—', authority: s.authority, sanctionNo: s.sanctionNo,
    sanctionedFar: Number(s.sanctionedFar), builtFar: Number(s.builtFar), deviationPct: Number(s.deviationPct),
    ocApplied: s.ocApplied, ocReceived: s.ocReceived, ocNumber: s.ocNumber,
    risk: ocRisk(Number(s.sanctionedFar), Number(s.builtFar)),
  }));
  const atRisk = mapped.filter((m) => m.risk === 'AT_RISK').length;
  const ocDone = mapped.filter((m) => m.ocReceived).length;
  return (
    <div className="space-y-6">
      <PageHeader title="BBMP / BDA plan sanction & FAR tracker" description="As-built vs sanctioned FAR/FSI, tower by tower. The moment built FAR pushes past the sanctioned limit's tolerance, the Occupancy Certificate is flagged at risk — so a deviation is caught during construction, not at OC application." />
      <PlanSanctionView projects={projects} counts={{ atRisk, ocDone, total: mapped.length }} rows={mapped} />
    </div>
  );
}
