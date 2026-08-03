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

/**
 * How many leads the board loads at once.
 *
 * The old cap of 300 quietly hid the rest: with 900 open leads the header said
 * 900 while the board showed the 300 most recently touched — so the 600 that
 * nobody had touched, exactly the ones at risk, were unreachable from the only
 * lead screen there is. The cap is now high enough to hold a real pipeline, and
 * the page says plainly when it has been reached.
 */
const LEAD_PAGE_SIZE = 2000;

export default async function SalesPage() {
  const ctx = await requirePermission('lead.view');
  const active = await getActiveProject(ctx.user.id);
  const scope = await leadScope(ctx); // all / own + my reports, by hierarchy
  const [leads, users, projects, total, nri, booked, siteVisits] = await Promise.all([
    prisma.lead.findMany({
      where: { deletedAt: null, ...scope, ...projectScope(active.id) }, orderBy: { updatedAt: 'desc' }, take: LEAD_PAGE_SIZE,
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
    updatedAt: l.updatedAt.toISOString(),
  }));

  return (
    <div>
      <PageHeader title="Sales & Leads" description="Track every inquiry from first touch to booking.">
        <Button asChild variant="outline" size="sm"><Link href="/sales/import"><Upload className="h-4 w-4" /> Import CSV</Link></Button>
        <Button asChild variant="outline" size="sm"><Link href="/sales/duplicates"><Merge className="h-4 w-4" /> Duplicates</Link></Button>
      </PageHeader>
      <div className="mb-6 stat-grid">
        <StatCard label="Total leads" value={total} icon={Users2} />
        <StatCard label="NRI leads" value={nri} icon={Globe2} tone="warning" />
        <StatCard label="Site visits" value={siteVisits} icon={CalendarCheck} />
        <StatCard label="Booked / Won" value={booked} icon={TrendingUp} tone="success" />
      </div>
      {total > serialized.length && (
        <p className="mb-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
          Showing the {serialized.length.toLocaleString('en-IN')} most recently updated of {total.toLocaleString('en-IN')} leads.
          Use search (⌘K) or narrow by project to reach the rest — none of them have been lost.
        </p>
      )}
      <SalesPipeline leads={serialized} users={users} projects={projects} />
    </div>
  );
}
