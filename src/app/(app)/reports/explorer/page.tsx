import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { runExplorer, type ExplorerEntity } from '@/server/services/explorer-service';
import { ExplorerView } from '@/components/reports/explorer-view';

export const metadata: Metadata = { title: 'Explorer' };

export default async function ExplorerPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await requirePermission('report.view');
  const sp = await searchParams;
  const entity = (['leads', 'bookings', 'units', 'collections'].includes(sp.entity || '') ? sp.entity : 'leads') as ExplorerEntity;
  const filters = { status: sp.status, source: sp.source, ownerId: sp.ownerId, projectId: sp.projectId, q: sp.q, from: sp.from, to: sp.to, temperature: sp.temperature };
  const [result, owners, projects, views] = await Promise.all([
    runExplorer(entity, filters),
    prisma.user.findMany({ where: { status: 'ACTIVE' }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.project.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.savedView.findMany({ where: { OR: [{ ownerId: ctx.user.id }, { isShared: true }] }, orderBy: { createdAt: 'desc' }, take: 50 }),
  ]);
  return (
    <div>
      <PageHeader title="Explorer" description="Build your own filtered report, save it as a view, export to Excel." />
      <ExplorerView
        entity={entity}
        filters={filters as Record<string, string | undefined>}
        columns={result.columns}
        rows={result.rows}
        total={result.total}
        owners={owners}
        projects={projects}
        canExport={can(ctx.permissions, 'report.export')}
        views={views.map((v) => ({ id: v.id, name: v.name, entity: v.entity, filters: (v.filters as Record<string, string>) ?? {}, isShared: v.isShared, mine: v.ownerId === ctx.user.id }))}
      />
    </div>
  );
}
