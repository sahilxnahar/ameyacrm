import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoadError } from '@/components/layout/page-load-error';
import { envConditions } from '@/server/services/compliance-service';
import { EsgRegister } from '@/components/compliance/esg-register';
export const metadata: Metadata = { title: 'Environment & ESG' };
export const dynamic = 'force-dynamic';
export default async function EsgPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const ctx = await requirePermission('esg.view');
  const canManage = can(ctx.permissions, 'esg.manage');
  const sp = await searchParams; const projectId = sp.project ?? null;
  try {
    const [projects, rows] = await Promise.all([prisma.project.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }), envConditions(projectId)]);
    return <div className="space-y-6"><PageHeader title="Environment & ESG" description="The conditions attached to your environmental clearance, each with an owner, evidence and a reporting date — because conditions are where clearances are breached." /><EsgRegister canManage={canManage} projects={projects} projectId={projectId} rows={rows} /></div>;
  } catch (e) { return <div className="space-y-6"><PageHeader title="Environment & ESG" description="EC conditions." /><PageLoadError error={e} /></div>; }
}
