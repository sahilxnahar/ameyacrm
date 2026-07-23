import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoadError } from '@/components/layout/page-load-error';
import { getActiveProject } from '@/server/services/active-project-service';
import { listHomeLoans } from '@/server/services/home-loan-service';
import { HomeLoansView } from '@/components/home-loans/home-loans-view';

export const metadata: Metadata = { title: 'Home Loans' };
export const dynamic = 'force-dynamic';

export default async function HomeLoansPage() {
  const ctx = await requirePermission('booking.view');
  try {
    const active = await getActiveProject(ctx.user.id);
    const { loans, summary } = await listHomeLoans(active.id ?? null);
    return (
      <div className="space-y-6">
        <PageHeader title="Home Loans" description="Track each buyer's home-loan journey — bank, sanction, disbursement, the NOC you issue to the bank, and the tripartite agreement." />
        <HomeLoansView loans={loans} summary={summary} canManage={can(ctx.permissions, 'booking.manage')} />
      </div>
    );
  } catch (e) {
    return <div className="space-y-6"><PageHeader title="Home Loans" description="Buyer home-loan tracking." /><PageLoadError error={e} /></div>;
  }
}
