import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoadError } from '@/components/layout/page-load-error';
import { transmittals } from '@/server/services/operations-service';
import { TransmittalsRegister } from '@/components/operations/transmittals-register';
export const metadata: Metadata = { title: 'Drawing Transmittals' };
export const dynamic = 'force-dynamic';
export default async function TransmittalsPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const ctx = await requirePermission('architecture.view'); const canManage = can(ctx.permissions, 'architecture.manage');
  const sp = await searchParams; const projectId = sp.project ?? null;
  try { const [projects, rows] = await Promise.all([prisma.project.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }), transmittals(projectId)]);
    return <div className="space-y-6"><PageHeader title="Drawing Transmittals" description="The formal issue of drawings to contractors and consultants, with an acknowledgement — the record of who was told what, when, that a dispute turns on." /><TransmittalsRegister canManage={canManage} projects={projects} projectId={projectId} rows={rows} /></div>;
  } catch (e) { return <div className="space-y-6"><PageHeader title="Drawing Transmittals" description="Transmittals." /><PageLoadError error={e} /></div>; }
}
