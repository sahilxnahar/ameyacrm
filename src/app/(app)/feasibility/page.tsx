import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoadError } from '@/components/layout/page-load-error';
import { feasibilityModels } from '@/server/services/feasibility-service';
import { FeasibilityView } from '@/components/feasibility/feasibility-view';

export const metadata: Metadata = { title: 'Feasibility' };
export const dynamic = 'force-dynamic';

export default async function FeasibilityPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const ctx = await requirePermission('feasibility.view');
  const canManage = can(ctx.permissions, 'feasibility.manage');
  const sp = await searchParams;
  const projectId = sp.project ?? null;
  try {
    const [projects, rows] = await Promise.all([
      prisma.project.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      feasibilityModels(projectId),
    ]);
    return (
      <div className="space-y-6">
        <PageHeader title="Feasibility & Appraisal" description="Model a potential project — land, construction, finance and sales — to see profit on cost, margin and the residual land value that decides what to bid, with a scenario knob for sale rate down and cost up." />
        <FeasibilityView canManage={canManage} projects={projects} projectId={projectId} rows={rows} />
      </div>
    );
  } catch (e) {
    return <div className="space-y-6"><PageHeader title="Feasibility & Appraisal" description="Development appraisal." /><PageLoadError error={e} /></div>;
  }
}
