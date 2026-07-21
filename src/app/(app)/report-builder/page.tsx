import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoadError } from '@/components/layout/page-load-error';
import { listSavedReports } from '@/server/services/report-service';
import { ReportBuilderView } from '@/components/reports/report-builder-view';

export const metadata: Metadata = { title: 'Report Builder' };
export const dynamic = 'force-dynamic';

export default async function ReportBuilderPage() {
  const ctx = await requirePermission('report.view');
  try {
    const saved = await listSavedReports(ctx.user.id);
    return (
      <div className="space-y-6">
        <PageHeader title="Report Builder" description="Pick a source, a field to group by and a measure — see the chart, then save it to run again. Only whitelisted sources and fields are offered, so nothing here can reach data you are not meant to see." />
        <ReportBuilderView saved={saved} canBuild={can(ctx.permissions, 'report.build')} />
      </div>
    );
  } catch (e) {
    return <div className="space-y-6"><PageHeader title="Report Builder" description="Custom reports." /><PageLoadError error={e} /></div>;
  }
}
