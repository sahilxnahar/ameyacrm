import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { MapView } from '@/components/map/map-view';

export const metadata: Metadata = { title: 'Map' };
export const dynamic = 'force-dynamic';

export default async function MapPage() {
  const ctx = await requirePermission('lead.view');
  const [projects, leads, localities] = await Promise.all([
    prisma.project.findMany({
      where: { isActive: true },
      select: { id: true, name: true, city: true, address: true, latitude: true, longitude: true },
    }),
    prisma.lead.findMany({
      where: { deletedAt: null, latitude: { not: null }, status: { notIn: ['LOST'] } },
      select: { id: true, name: true, reference: true, latitude: true, longitude: true, status: true, temperature: true, locality: true },
      take: 800,
    }),
    prisma.lead.groupBy({ by: ['locality'], where: { deletedAt: null, locality: { not: null } }, _count: { _all: true } }),
  ]);

  return (
    <div>
      <PageHeader
        title="Map"
        description="Project sites and where your enquiries are coming from. Built on OpenStreetMap — no Google account, no billing."
      />
      <MapView
        canManage={can(ctx.permissions, 'admin.setting.manage')}
        projects={projects.map((p) => ({ id: p.id, name: p.name, city: p.city, address: p.address, lat: p.latitude, lng: p.longitude }))}
        leads={leads.map((l) => ({ id: l.id, name: l.name, reference: l.reference, lat: l.latitude!, lng: l.longitude!, status: l.status, temperature: l.temperature, locality: l.locality }))}
        localities={localities
          .filter((l) => l.locality)
          .map((l) => ({ locality: l.locality as string, count: l._count._all }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 20)}
      />
    </div>
  );
}
