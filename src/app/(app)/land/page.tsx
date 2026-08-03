import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { ScreenHelp } from '@/components/layout/screen-help';
import { PageLoadError } from '@/components/layout/page-load-error';
import { landOverview } from '@/server/services/land-service';
import { LandView } from '@/components/land/land-view';
import { powersOfAttorney, jointDevelopmentAgreements, registerCounts } from '@/server/services/compliance-service';
import { RegisterTabs } from '@/components/compliance/register-tabs';
import { PoaRegister, JdaRegister } from '@/components/compliance/extra-registers';

export const metadata: Metadata = { title: 'Land & Approvals' };
export const dynamic = 'force-dynamic';

export default async function LandPage({ searchParams }: { searchParams: Promise<{ project?: string; view?: string }> }) {
  const ctx = await requirePermission('land.view');
  const canManage = can(ctx.permissions, 'land.manage');
  const sp = await searchParams;

  try {
    const projects = await prisma.project.findMany({
      where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' },
    });
    const projectId = sp.project ?? null;
    const view = ['parcels', 'poa', 'jda'].includes(sp.view ?? '') ? sp.view! : 'parcels';
    const [data, counts, poaRows, jdaRows, parcelOpts] = await Promise.all([
      landOverview(new Date(), projectId),
      registerCounts(projectId),
      view === 'poa' ? powersOfAttorney(projectId) : Promise.resolve([]),
      view === 'jda' ? jointDevelopmentAgreements() : Promise.resolve([]),
      view === 'jda'
        ? prisma.landParcel.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' }, take: 500 })
        : Promise.resolve([] as { id: string; name: string }[]),
    ]);

    return (
      <div className="space-y-6">
        <PageHeader
          title="Land & Approvals"
          description={view === 'poa'
            ? 'Every general and special power of attorney in the title chain, with what it actually covers and when it stops being valid.'
            : view === 'jda'
              ? 'The joint development agreements — share split, refundable deposit and signing date, against the parcel each one binds.'
              : "The parcels, the title chain, the sanctions and the matters in court. A gap in the chain shows as a gap here — not when a buyer's lawyer finds it — and an approval whose expected date has passed is flagged rather than forgotten."}
        />
        <RegisterTabs
          basePath="/land"
          current={view}
          projectId={projectId}
          tabs={[
            { key: 'parcels', label: 'Parcels & approvals', count: data.parcels.length },
            { key: 'poa', label: 'Powers of attorney', count: counts.poa },
            { key: 'jda', label: 'JDAs', count: counts.jda },
          ]}
        />
        {view === 'poa' && <PoaRegister canManage={canManage} projects={projects} projectId={projectId} rows={poaRows} />}
        {view === 'jda' && <JdaRegister canManage={canManage} rows={jdaRows} parcels={parcelOpts} />}
        {view === 'parcels' && <>
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
        </>}
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
