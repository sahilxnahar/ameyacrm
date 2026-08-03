import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoadError } from '@/components/layout/page-load-error';
import { risks, contracts, insurancePolicies, licenceRenewals, registerCounts } from '@/server/services/compliance-service';
import { GovernanceRegister } from '@/components/compliance/governance-register';
import { RegisterTabs } from '@/components/compliance/register-tabs';
import { ContractsRegister, InsuranceRegister, RenewalsRegister } from '@/components/compliance/extra-registers';

export const metadata: Metadata = { title: 'Governance & Risk' };
export const dynamic = 'force-dynamic';

const DESCRIPTIONS: Record<string, string> = {
  risks: 'The risk register, scored likelihood × impact and sorted worst-first, so a board looks at the risks that actually matter.',
  contracts: 'Every contract you are bound by, with the date you have to decide on renewal — which is earlier than the date it expires.',
  insurance: 'Cover in force, what it insures and when it lapses. A site with lapsed CAR or workmen’s cover is an uninsured site.',
  renewals: 'Licences, NOCs and certificates that stop work when they lapse — tracked before they do, not after.',
};

export default async function GovernancePage({ searchParams }: { searchParams: Promise<{ project?: string; view?: string }> }) {
  const ctx = await requirePermission('governance.view');
  const canManage = can(ctx.permissions, 'governance.manage');
  const sp = await searchParams;
  const projectId = sp.project ?? null;
  const view = ['risks', 'contracts', 'insurance', 'renewals'].includes(sp.view ?? '') ? sp.view! : 'risks';

  try {
    const [projects, counts, riskRows, contractRows, policyRows, renewalRows] = await Promise.all([
      prisma.project.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      registerCounts(projectId),
      view === 'risks' ? risks(projectId) : Promise.resolve([]),
      view === 'contracts' ? contracts(projectId) : Promise.resolve([]),
      view === 'insurance' ? insurancePolicies(projectId) : Promise.resolve([]),
      view === 'renewals' ? licenceRenewals(projectId) : Promise.resolve([]),
    ]);

    return (
      <div className="space-y-6">
        <PageHeader title="Governance & Risk" description={DESCRIPTIONS[view] ?? DESCRIPTIONS.risks!} />
        <RegisterTabs
          basePath="/governance"
          current={view}
          projectId={projectId}
          tabs={[
            { key: 'risks', label: 'Risk register', count: counts.risk },
            { key: 'contracts', label: 'Contracts', count: counts.contract },
            { key: 'insurance', label: 'Insurance', count: counts.policy },
            { key: 'renewals', label: 'Licences & renewals', count: counts.renewal },
          ]}
        />
        {view === 'risks' && <GovernanceRegister canManage={canManage} projects={projects} projectId={projectId} rows={riskRows} />}
        {view === 'contracts' && <ContractsRegister canManage={canManage} projects={projects} projectId={projectId} rows={contractRows} />}
        {view === 'insurance' && <InsuranceRegister canManage={canManage} projects={projects} projectId={projectId} rows={policyRows} />}
        {view === 'renewals' && <RenewalsRegister canManage={canManage} projects={projects} projectId={projectId} rows={renewalRows} />}
      </div>
    );
  } catch (e) {
    return <div className="space-y-6"><PageHeader title="Governance & Risk" description="Risks, contracts, insurance and renewals." /><PageLoadError error={e} /></div>;
  }
}
