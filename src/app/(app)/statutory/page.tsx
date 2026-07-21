import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoadError } from '@/components/layout/page-load-error';
import { obligations } from '@/server/services/compliance-service';
import { StatutoryRegister } from '@/components/compliance/statutory-register';
export const metadata: Metadata = { title: 'Statutory Calendar' };
export const dynamic = 'force-dynamic';
export default async function StatutoryPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const ctx = await requirePermission('statutory.view');
  const canManage = can(ctx.permissions, 'statutory.manage');
  const sp = await searchParams; const projectId = sp.project ?? null;
  try {
    const [projects, rows] = await Promise.all([prisma.project.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }), obligations(projectId)]);
    return <div className="space-y-6"><PageHeader title="Statutory Calendar" description="Every recurring obligation — GST, TDS, RERA, PF/ESI, ROC — with an owner and a chase-before date, so a deadline is met, not discovered." /><StatutoryRegister canManage={canManage} projects={projects} projectId={projectId} rows={rows} /></div>;
  } catch (e) { return <div className="space-y-6"><PageHeader title="Statutory Calendar" description="Statutory obligations." /><PageLoadError error={e} /></div>; }
}
