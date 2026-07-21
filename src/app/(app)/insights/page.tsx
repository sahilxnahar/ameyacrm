import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoadError } from '@/components/layout/page-load-error';
import { getInsights } from '@/server/services/insights-service';
import { InsightsView } from '@/components/reports/insights-view';

export const metadata: Metadata = { title: 'Insights' };
export const dynamic = 'force-dynamic';

export default async function InsightsPage() {
  await requirePermission('report.view');
  try {
    const data = await getInsights();
    return (
      <div className="space-y-6">
        <PageHeader title="Insights" description="Quiet, statistical checks that need no setup: bills that stand out against a material's running rate, and how the lead scores are spread. No live model, so nothing here can fail on a missing key." />
        <InsightsView data={data} />
      </div>
    );
  } catch (e) {
    return <div className="space-y-6"><PageHeader title="Insights" description="Cost anomalies and pipeline health." /><PageLoadError error={e} /></div>;
  }
}
