import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoadError } from '@/components/layout/page-load-error';
import { maintenanceCharges } from '@/server/services/operations-service';
import { AssociationRegister } from '@/components/operations/association-register';
export const metadata: Metadata = { title: 'Association & CAM' };
export const dynamic = 'force-dynamic';
export default async function AssociationPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const ctx = await requirePermission('association.view'); const canManage = can(ctx.permissions, 'association.manage');
  const sp = await searchParams; const projectId = sp.project ?? null;
  try { const [projects, rows] = await Promise.all([prisma.project.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }), maintenanceCharges(projectId)]);
    return <div className="space-y-6"><PageHeader title="Association & Maintenance" description="Common-area maintenance billing per unit — raised, aged and collected — for the twenty-year tail after handover." /><AssociationRegister canManage={canManage} projects={projects} projectId={projectId} rows={rows} /></div>;
  } catch (e) { return <div className="space-y-6"><PageHeader title="Association & Maintenance" description="CAM billing." /><PageLoadError error={e} /></div>; }
}
