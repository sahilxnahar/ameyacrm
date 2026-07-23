import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { PageHeader } from '@/components/layout/page-header';
import { getActiveProject } from '@/server/services/active-project-service';
import { getSpendReport } from '@/server/services/spend-report-service';
import { getCostToComplete } from '@/server/services/cost-to-complete-service';
import { SpendReportView } from '@/components/finance/spend-report-view';
import { CostToCompleteTable } from '@/components/finance/cost-to-complete-table';
import { StatutoryCalendar } from '@/components/finance/statutory-calendar';

export const metadata: Metadata = { title: 'Spend Report' };
export const dynamic = 'force-dynamic';

export default async function SpendPage() {
  const ctx = await requirePermission('finance.ledger.view');
  const active = await getActiveProject(ctx.user.id);
  const [report, cost] = await Promise.all([getSpendReport(active.id), getCostToComplete()]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Spend Report"
        description="Where the money has gone — by category, project, payee and month. Built from every payment you've recorded."
      />
      <SpendReportView report={report} projectName={active.name} />
      <CostToCompleteTable rows={cost} />
      <StatutoryCalendar />
    </div>
  );
}
