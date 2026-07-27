import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { BimSyncView } from '@/components/legal/bim-sync-view';

export const metadata: Metadata = { title: '4D BIM Sync' };
export const dynamic = 'force-dynamic';

export default async function BimSyncPage() {
  await requirePermission('procurement.view');
  const [models, projects, milestones] = await Promise.all([
    prisma.bimModel.findMany({ orderBy: { createdAt: 'desc' }, take: 100, include: { project: { select: { name: true } }, phases: { orderBy: { createdAt: 'asc' } } } }).catch(() => []),
    prisma.project.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }).catch(() => []),
    prisma.paymentMilestone.findMany({ where: { status: { in: ['PENDING', 'PARTIAL'] } }, select: { id: true, label: true, amount: true }, take: 100, orderBy: { dueDate: 'asc' } }).catch(() => []),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title="4D BIM & Construction Timeline Sync" description="Link the 3D model to real site progress. Completing a phase — a slab cast, a tower topped out — can trip its linked buyer payment milestone, so physical progress raises the demand automatically. 4D means the model, plus time, plus cash flow." />
      <BimSyncView
        projects={projects}
        milestones={milestones.map((m) => ({ id: m.id, label: m.label, amount: Number(m.amount) }))}
        models={models.map((m) => ({
          id: m.id, name: m.name, project: m.project?.name ?? '—', discipline: m.discipline, progressPct: Number(m.progressPct), urn: m.urn,
          phases: m.phases.map((p) => ({ id: p.id, label: p.label, plannedOn: p.plannedOn?.toISOString() ?? null, actualOn: p.actualOn?.toISOString() ?? null, triggersDemand: p.triggersDemand, linked: !!p.milestoneId })),
        }))}
      />
    </div>
  );
}
