import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { ScreenHelp } from '@/components/layout/screen-help';
import { PageLoadError } from '@/components/layout/page-load-error';
import { goodsReceipts } from '@/server/services/compliance-service';
import { ProcurementRegister } from '@/components/compliance/procurement-register';
export const metadata: Metadata = { title: 'Procurement' };
export const dynamic = 'force-dynamic';
export default async function ProcurementPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const ctx = await requirePermission('procurement.view');
  const canManage = can(ctx.permissions, 'procurement.manage');
  const sp = await searchParams; const projectId = sp.project ?? null;
  try {
    const [projects, rows] = await Promise.all([prisma.project.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }), goodsReceipts(projectId)]);
    return <div className="space-y-6"><PageHeader title="Procurement — Goods Received" helpTermId="three-way" description="The three-way match: what was ordered, what turned up, and what you are billed for. Where they disagree, it says how — the control that stops paying for material that never arrived." />
        <ScreenHelp id="procurement" /><ProcurementRegister canManage={canManage} projects={projects} projectId={projectId} rows={rows} /></div>;
  } catch (e) { return <div className="space-y-6"><PageHeader title="Procurement — Goods Received" description="Goods received & three-way match." /><PageLoadError error={e} /></div>; }
}
