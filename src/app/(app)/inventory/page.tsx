import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { getActiveProject } from '@/server/services/active-project-service';
import { can } from '@/lib/rbac/can';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { InventoryMatrix } from '@/components/inventory/inventory-matrix';
import { releaseExpiredHolds } from '@/lib/inventory/auto-release';

export const metadata: Metadata = { title: 'Inventory' };

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const ctx = await requirePermission('booking.view');
  await releaseExpiredHolds(); // opportunistic auto-release of expired holds
  const projects = await prisma.project.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } });
  const sp = await searchParams;
  // The URL wins if it names a real project; otherwise fall back to whatever
  // the person has selected in the header, and only then to the first one.
  const active = await getActiveProject(ctx.user.id);
  const projectId = sp.project && projects.some((p) => p.id === sp.project)
    ? sp.project
    : (active.id && projects.some((p) => p.id === active.id) ? active.id : projects[0]?.id ?? null);
  const [units, leads] = projectId
    ? await Promise.all([
        prisma.unit.findMany({ where: { projectId }, orderBy: [{ tower: 'asc' }, { floor: 'desc' }, { code: 'asc' }] }),
        prisma.lead.findMany({ where: { deletedAt: null, OR: [{ projectId }, { projectId: null }] }, orderBy: { createdAt: 'desc' }, take: 200, select: { id: true, name: true } }),
      ])
    : [[], [] as { id: string; name: string }[]];
  const canManage = can(ctx.permissions, 'booking.manage');
  return (
    <div>
      <PageHeader title="Inventory" description="Live unit availability across your projects." />
      <InventoryMatrix
        projects={projects}
        projectId={projectId}
        canManage={canManage}
        leads={leads as { id: string; name: string }[]}
        units={(units as typeof units).map((u) => ({
          id: u.id, code: u.code, tower: u.tower, floor: u.floor, typology: u.typology, facing: u.facing,
          carpetAreaSqft: u.carpetAreaSqft ? Number(u.carpetAreaSqft) : null, price: u.price ? Number(u.price) : null,
          status: u.status, holdUntil: u.holdUntil ? u.holdUntil.toISOString() : null,
          tokenAmount: u.tokenAmount ? Number(u.tokenAmount) : null, holdNote: u.holdNote,
        }))}
      />
    </div>
  );
}
