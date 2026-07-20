import type { Metadata } from 'next';
import Link from 'next/link';
import { Users2, Globe2, TrendingUp, CalendarCheck, Upload, Merge } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { requirePermission } from '@/lib/auth/current-user';
import { leadScope } from '@/lib/rbac/scope';
import { prisma } from '@/lib/db/prisma';
import { getActiveProject, projectScope } from '@/server/services/active-project-service';
import { PageHeader } from '@/components/layout/page-header';
import { StatCard } from '@/components/layout/stat-card';
import { SalesPipeline } from '@/components/sales/sales-pipeline';

export const metadata: Metadata = { title: 'Sales & Leads' };

export default async function SalesPage() {
  const ctx = await requirePermission('lead.view');
  const active = await getActiveProject(ctx.user.id);
  const scope = await leadScope(ctx); // all / own + my reports, by hierarchy
  const [leads, users, projects, total, nri, booked, siteVisits] = await Promise.all([
    prisma.lead.findMany({
      where: { deletedAt: null, ...scope, ...projectScope(active.id) }, orderBy: { updatedAt: 'desc' }, take: 300,
      include: { owner: { select: { name: true } }, project: { select: { name: true } } },
    }),
    prisma.user.findMany({ where: { status: 'ACTIVE' }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.project.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
    prisma.lead.count({ where: { deletedAt: null, ...scope, ...projectScope(active.id) } }),
    prisma.lead.count({ where: { deletedAt: null, isNri: true, ...scope } }),
    prisma.lead.count({ where: { deletedAt: null, status: { in: ['BOOKED', 'WON'] }, ...scope } }),
    prisma.lead.count({ where: { deletedAt: null, status: 'SITE_VISIT', ...scope } }),
  ]);

  const serialized = leads.map((l) => ({
    id: l.id, reference: l.reference, name: l.name, status: l.status, source: l.source,
    isNri: l.isNri, country: l.country, ownerName: l.owner?.name ?? null, projectName: l.project?.name ?? null,
    budgetMax: l.budgetMax ? Number(l.budgetMax) : null,
  }));

  return (
    <div>
      <PageHeader title="Sales & Leads" description="Track every inquiry from first touch to booking.">
        <Button asChild variant="outline" size="sm"><Link href="/sales/import"><Upload className="h-4 w-4" /> Import CSV</Link></Button>
        <Button asChild variant="outline" size="sm"><Link href="/sales/duplicates"><Merge className="h-4 w-4" /> Duplicates</Link></Button>
      </PageHeader>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Total leads" value={total} icon={Users2} />
        <StatCard label="NRI leads" value={nri} icon={Globe2} tone="warning" />
        <StatCard label="Site visits" value={siteVisits} icon={CalendarCheck} />
        <StatCard label="Booked / Won" value={booked} icon={TrendingUp} tone="success" />
      </div>
      <SalesPipeline leads={serialized} users={users} projects={projects} />
    </div>
  );
}
