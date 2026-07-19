import type { Metadata } from 'next';
import { FileSpreadsheet } from 'lucide-react';
import { requirePermission } from '@/lib/auth/current-user';
import { getReportData } from '@/server/services/report-service';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { ReportsCharts } from '@/components/reports/reports-charts';

export const metadata: Metadata = { title: 'Reports' };

export default async function ReportsPage() {
  await requirePermission('report.view');
  const data = await getReportData();
  return (
    <div>
      <PageHeader title="Reports & Analytics" description="Workload, performance and pipeline at a glance.">
        <Button asChild variant="outline" size="sm"><a href="/api/reports/tasks.csv"><FileSpreadsheet className="h-4 w-4" /> Export tasks (CSV)</a></Button>
      </PageHeader>
      <ReportsCharts data={data} />
    </div>
  );
}
