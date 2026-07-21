import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoadError } from '@/components/layout/page-load-error';
import { tenancies } from '@/server/services/operations-service';
import { LeasingRegister } from '@/components/operations/leasing-register';
export const metadata: Metadata = { title: 'Commercial Leasing' };
export const dynamic = 'force-dynamic';
export default async function LeasingPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const ctx = await requirePermission('lease.view'); const canManage = can(ctx.permissions, 'lease.manage');
  const sp = await searchParams; const projectId = sp.project ?? null;
  try { const [projects, rows] = await Promise.all([prisma.project.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }), tenancies(projectId)]);
    return <div className="space-y-6"><PageHeader title="Commercial Leasing" description="The rent roll — every tenancy, area, rate, term and escalation on one screen — for the parts of the portfolio held for income rather than sold." /><LeasingRegister canManage={canManage} projects={projects} projectId={projectId} rows={rows} /></div>;
  } catch (e) { return <div className="space-y-6"><PageHeader title="Commercial Leasing" description="Rent roll." /><PageLoadError error={e} /></div>; }
}
