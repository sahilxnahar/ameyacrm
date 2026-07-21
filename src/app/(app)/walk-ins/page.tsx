import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoadError } from '@/components/layout/page-load-error';
import { walkIns } from '@/server/services/operations-service';
import { WalkInsRegister } from '@/components/operations/walkins-register';
export const metadata: Metadata = { title: 'Walk-ins' };
export const dynamic = 'force-dynamic';
export default async function WalkInsPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const ctx = await requirePermission('lead.view'); const canManage = can(ctx.permissions, 'lead.create');
  const sp = await searchParams; const projectId = sp.project ?? null;
  try { const [projects, rows] = await Promise.all([prisma.project.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }), walkIns(projectId)]);
    return <div className="space-y-6"><PageHeader title="Walk-ins & Site Visits" description="The funnel step where property is actually sold — walk-ins and site visits, captured with their source and outcome." /><WalkInsRegister canManage={canManage} projects={projects} projectId={projectId} rows={rows} /></div>;
  } catch (e) { return <div className="space-y-6"><PageHeader title="Walk-ins & Site Visits" description="Walk-ins." /><PageLoadError error={e} /></div>; }
}
