import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoadError } from '@/components/layout/page-load-error';
import { envConditions, wasteManifests } from '@/server/services/compliance-service';
import { EsgRegister } from '@/components/compliance/esg-register';
import { RegisterTabs } from '@/components/compliance/register-tabs';
import { WasteRegister } from '@/components/compliance/extra-registers';

export const metadata: Metadata = { title: 'Environment & ESG' };
export const dynamic = 'force-dynamic';

const DESCRIPTIONS: Record<string, string> = {
  conditions: 'The conditions attached to your environmental clearance, each with an owner, evidence and a reporting date — because conditions are where clearances are breached.',
  waste: 'Where the construction and demolition waste went, and the manifest that proves it. Ask for it after the fact and it does not exist.',
};

export default async function EsgPage({ searchParams }: { searchParams: Promise<{ project?: string; view?: string }> }) {
  const ctx = await requirePermission('esg.view');
  const canManage = can(ctx.permissions, 'esg.manage');
  const sp = await searchParams;
  const projectId = sp.project ?? null;
  const view = ['conditions', 'waste'].includes(sp.view ?? '') ? sp.view! : 'conditions';

  try {
    const [projects, condRows, wasteRows] = await Promise.all([
      prisma.project.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      envConditions(projectId),
      wasteManifests(projectId),
    ]);

    return (
      <div className="space-y-6">
        <PageHeader title="Environment & ESG" description={DESCRIPTIONS[view] ?? DESCRIPTIONS.conditions!} />
        <RegisterTabs
          basePath="/esg"
          current={view}
          projectId={projectId}
          tabs={[
            { key: 'conditions', label: 'Clearance conditions', count: condRows.length },
            { key: 'waste', label: 'Waste manifests', count: wasteRows.length },
          ]}
        />
        {view === 'conditions' && <EsgRegister canManage={canManage} projects={projects} projectId={projectId} rows={condRows} />}
        {view === 'waste' && <WasteRegister canManage={canManage} projects={projects} projectId={projectId} rows={wasteRows} />}
      </div>
    );
  } catch (e) {
    return <div className="space-y-6"><PageHeader title="Environment & ESG" description="EC conditions and waste manifests." /><PageLoadError error={e} /></div>;
  }
}
