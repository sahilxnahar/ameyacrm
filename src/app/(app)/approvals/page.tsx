import type { Metadata } from 'next';
import { requireAuth } from '@/lib/auth/current-user';
import { getMyPendingApprovals } from '@/server/services/approvals-service';
import { PageHeader } from '@/components/layout/page-header';
import { ApprovalsInbox } from '@/components/approvals/approvals-inbox';

export const metadata: Metadata = { title: 'Approvals' };

export default async function ApprovalsPage() {
  const { user } = await requireAuth();
  const items = await getMyPendingApprovals(user.id);
  return (
    <div className="max-w-3xl">
      <PageHeader title="Approvals" description="Everything awaiting your decision, in one place." />
      <ApprovalsInbox items={items} />
    </div>
  );
}
