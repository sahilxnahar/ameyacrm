import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { PageHeader } from '@/components/layout/page-header';
import { getOrgChart } from '@/server/services/hierarchy-service';
import { OrgChartView } from '@/components/team/org-chart-view';

export const metadata: Metadata = { title: 'Team & Hierarchy' };
export const dynamic = 'force-dynamic';

export default async function TeamPage() {
  const ctx = await requirePermission('dashboard.view');
  const { people, departments, gaps } = await getOrgChart();
  return (
    <div>
      <PageHeader
        title="Team & hierarchy"
        description="Who reports to whom, and which team each person sits in. Reporting lines decide who can see whose work."
      />
      <OrgChartView
        people={people}
        departments={departments}
        gaps={gaps}
        canEdit={can(ctx.permissions, 'admin.user.manage')}
        canChangeRoles={ctx.user.role === 'SUPER_ADMIN'}
        meId={ctx.user.id}
      />
    </div>
  );
}
