import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoadError } from '@/components/layout/page-load-error';
import { unitPricing, commissionOverview } from '@/server/services/sales-service';
import { PricingView } from '@/components/sales/pricing-view';

export const metadata: Metadata = { title: 'Pricing & Commissions' };
export const dynamic = 'force-dynamic';

export default async function PricingPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const ctx = await requirePermission('pricing.view');
  const canManage = can(ctx.permissions, 'pricing.manage');
  const sp = await searchParams;

  try {
    const projects = await prisma.project.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } });
    const projectId = sp.project ?? ctx.user.activeProjectId ?? projects[0]?.id ?? null;
    const [units, commissions] = await Promise.all([unitPricing(projectId), commissionOverview(projectId)]);

    return (
      <div className="space-y-6">
        <PageHeader
          title="Pricing & Commissions"
          description="A unit's price computed from base rate, floor rise, PLC and view premium less discount — so everyone quotes the same flat the same way — and broker commission worked out on a slab with TDS, so the person who brings you buyers is paid the right amount every time. A discount beyond your limit is flagged for approval, not quietly given."
        />
        <PricingView canManage={canManage} projects={projects} projectId={projectId} units={units} commissions={commissions} />
      </div>
    );
  } catch (e) {
    return (
      <div className="space-y-6">
        <PageHeader title="Pricing & Commissions" description="Unit pricing and broker commissions." />
        <PageLoadError error={e} />
      </div>
    );
  }
}
