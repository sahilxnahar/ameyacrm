import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoadError } from '@/components/layout/page-load-error';
import { risks } from '@/server/services/compliance-service';
import { GovernanceRegister } from '@/components/compliance/governance-register';
export const metadata: Metadata = { title: 'Governance & Risk' };
export const dynamic = 'force-dynamic';
export default async function GovernancePage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const ctx = await requirePermission('governance.view');
  const canManage = can(ctx.permissions, 'governance.manage');
  const sp = await searchParams; const projectId = sp.project ?? null;
  try {
    const [projects, rows] = await Promise.all([prisma.project.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }), risks(projectId)]);
    return <div className="space-y-6"><PageHeader title="Governance & Risk" description="The risk register, scored likelihood × impact and sorted worst-first, so a board looks at the risks that actually matter." /><GovernanceRegister canManage={canManage} projects={projects} projectId={projectId} rows={rows} /></div>;
  } catch (e) { return <div className="space-y-6"><PageHeader title="Governance & Risk" description="Risk register." /><PageLoadError error={e} /></div>; }
}
