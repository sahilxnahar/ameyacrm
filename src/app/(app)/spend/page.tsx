import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { PageHeader } from '@/components/layout/page-header';
import { getActiveProject } from '@/server/services/active-project-service';
import { getSpendReport } from '@/server/services/spend-report-service';
import { SpendReportView } from '@/components/finance/spend-report-view';

export const metadata: Metadata = { title: 'Spend Report' };
export const dynamic = 'force-dynamic';

export default async function SpendPage() {
  const ctx = await requirePermission('finance.ledger.view');
  const active = await getActiveProject(ctx.user.id);
  const report = await getSpendReport(active.id);

  return (
    <div>
      <PageHeader
        title="Spend Report"
        description="Where the money has gone — by category, project, payee and month. Built from every payment you've recorded."
      />
      <SpendReportView report={report} projectName={active.name} />
    </div>
  );
}
