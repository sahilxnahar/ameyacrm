import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { ScreenHelp } from '@/components/layout/screen-help';
import { PageLoadError } from '@/components/layout/page-load-error';
import { landOverview } from '@/server/services/land-service';
import { LandView } from '@/components/land/land-view';

export const metadata: Metadata = { title: 'Land & Approvals' };
export const dynamic = 'force-dynamic';

export default async function LandPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const ctx = await requirePermission('land.view');
  const canManage = can(ctx.permissions, 'land.manage');
  const sp = await searchParams;

  try {
    const projects = await prisma.project.findMany({
      where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' },
    });
    const projectId = sp.project ?? null;
    const data = await landOverview(new Date(), projectId);

    return (
      <div className="space-y-6">
        <PageHeader
          title="Land & Approvals"
          description="The parcels, the title chain, the sanctions and the matters in court. A gap in the chain shows as a gap here — not when a buyer's lawyer finds it — and an approval whose expected date has passed is flagged rather than forgotten."
        />
        <ScreenHelp id="land" />
        <LandView
          canManage={canManage}
          projects={projects}
          projectId={projectId}
          parcels={data.parcels}
          approvals={data.approvals}
          approvalSummary={data.approvalSummary}
          litigation={data.litigation}
          parcelsWithGaps={data.parcelsWithGaps}
        />
      </div>
    );
  } catch (e) {
    return (
      <div className="space-y-6">
        <PageHeader title="Land & Approvals" helpTermId="title-chain" description="Parcels, title, sanctions and litigation." />
        <PageLoadError error={e} />
      </div>
    );
  }
}
