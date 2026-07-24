import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import nextDynamic from 'next/dynamic';
const FloorPlanView = nextDynamic(() => import('@/components/floorplan/floor-plan-view').then((m) => m.FloorPlanView), {
  loading: () => <div className="h-[500px] animate-pulse rounded-lg bg-secondary" />,
});

export const metadata: Metadata = { title: 'Floor plans' };
export const dynamic = 'force-dynamic';

export default async function FloorPlansPage() {
  const ctx = await requirePermission('booking.view');
  const [projects, plans, units] = await Promise.all([
    prisma.project.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.floorPlan.findMany({
      where: { isActive: true },
      orderBy: [{ tower: 'asc' }, { floor: 'asc' }],
      include: { pins: { select: { id: true, unitId: true, x: true, y: true, w: true, h: true } } },
    }),
    prisma.unit.findMany({
      select: { id: true, code: true, projectId: true, tower: true, floor: true, typology: true, carpetAreaSqft: true, price: true, status: true, facing: true },
      orderBy: { code: 'asc' },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Floor plans"
        description="Show a buyer the actual plan, tap a flat, and see its price and availability there and then."
      />
      <FloorPlanView
        canManage={can(ctx.permissions, 'booking.manage')}
        projects={projects}
        plans={plans.map((p) => ({
          id: p.id, projectId: p.projectId, name: p.name, tower: p.tower, floor: p.floor,
          imageUrl: p.imageUrl, kind: p.kind, description: p.description,
          isPublic: p.isPublic, shareToken: p.shareToken,
          pins: p.pins.map((x) => ({ id: x.id, unitId: x.unitId, x: x.x, y: x.y, w: x.w, h: x.h })),
        }))}
        units={units.map((u) => ({
          id: u.id, code: u.code, projectId: u.projectId, tower: u.tower, floor: u.floor,
          typology: u.typology, area: Number(u.carpetAreaSqft), price: Number(u.price),
          status: u.status, facing: u.facing,
        }))}
      />
    </div>
  );
}
