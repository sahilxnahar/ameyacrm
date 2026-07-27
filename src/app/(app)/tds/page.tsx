import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { PageHeader } from '@/components/layout/page-header';
import { tdsDashboard } from '@/server/actions/tds';
import { TdsView } from '@/components/finance/tds-view';

export const metadata: Metadata = { title: 'TDS' };
export const dynamic = 'force-dynamic';

export default async function TdsPage() {
  const ctx = await requirePermission('finance.ledger.view');
  const data = await tdsDashboard();
  const dashboard = 'error' in data ? { accrued: 0, deposited: 0, pending: 0, count: 0, pendingCount: 0, bySection: [], recent: [] } : data;
  return (
    <div className="space-y-6">
      <PageHeader title="TDS" description="Tax Deducted at Source — what you've deducted, what you've deposited, and what's still due. Auto-mapped to the right section, with a per-account ledger." />
      <TdsView dashboard={dashboard} canManage={can(ctx.permissions, 'finance.ledger.manage')} />
    </div>
  );
}
