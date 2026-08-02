import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoadError } from '@/components/layout/page-load-error';
import { incidents, accessReviews } from '@/server/services/compliance-service';
import { SecopsRegister } from '@/components/compliance/secops-register';
import { RegisterTabs } from '@/components/compliance/register-tabs';
import { AccessReviewRegister } from '@/components/compliance/extra-registers';

export const metadata: Metadata = { title: 'Security Operations' };
export const dynamic = 'force-dynamic';

const DESCRIPTIONS: Record<string, string> = {
  incidents: 'The incident register — anomalous access, exports, suspected breaches — tracked to resolution. Prevention is your locks; this is detection.',
  access: 'Who has access to what, reviewed on a schedule. Most access nobody should still have is access nobody ever took away.',
};

export default async function SecopsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const ctx = await requirePermission('secops.view');
  const canManage = can(ctx.permissions, 'secops.manage');
  const sp = await searchParams;
  const view = ['incidents', 'access'].includes(sp.view ?? '') ? sp.view! : 'incidents';

  try {
    const [incidentRows, reviewRows] = await Promise.all([incidents(), accessReviews()]);
    return (
      <div className="space-y-6">
        <PageHeader title="Security Operations" description={DESCRIPTIONS[view] ?? DESCRIPTIONS.incidents!} />
        <RegisterTabs
          basePath="/security-ops"
          current={view}
          tabs={[
            { key: 'incidents', label: 'Incidents', count: incidentRows.length },
            { key: 'access', label: 'Access reviews', count: reviewRows.length },
          ]}
        />
        {view === 'incidents' && <SecopsRegister canManage={canManage} rows={incidentRows} />}
        {view === 'access' && <AccessReviewRegister canManage={canManage} rows={reviewRows} />}
      </div>
    );
  } catch (e) {
    return <div className="space-y-6"><PageHeader title="Security Operations" description="Incidents and access reviews." /><PageLoadError error={e} /></div>;
  }
}
