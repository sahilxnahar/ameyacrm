import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoadError } from '@/components/layout/page-load-error';
import { variations } from '@/server/services/operations-service';
import { VariationsRegister } from '@/components/operations/variations-register';
export const metadata: Metadata = { title: 'Buyer Variations' };
export const dynamic = 'force-dynamic';
export default async function VariationsPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const ctx = await requirePermission('variations.view'); const canManage = can(ctx.permissions, 'variations.manage');
  const sp = await searchParams; const projectId = sp.project ?? null;
  try { const [projects, rows] = await Promise.all([prisma.project.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }), variations(projectId)]);
    return <div className="space-y-6"><PageHeader title="Buyer Variations" description="Buyer change requests — raised, costed, approved and accepted, with the price agreed before the work, so the argument never arrives at handover." /><VariationsRegister canManage={canManage} projects={projects} projectId={projectId} rows={rows} /></div>;
  } catch (e) { return <div className="space-y-6"><PageHeader title="Buyer Variations" description="Variation orders." /><PageLoadError error={e} /></div>; }
}
