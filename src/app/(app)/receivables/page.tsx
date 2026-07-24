import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { PageHeader } from '@/components/layout/page-header';
import { getActiveProject } from '@/server/services/active-project-service';
import { getReceivables } from '@/server/services/receivables-service';
import { ReceivablesView } from '@/components/receivables/receivables-view';

export const metadata: Metadata = { title: 'Money owed to us' };
export const dynamic = 'force-dynamic';

export default async function ReceivablesPage() {
  const ctx = await requirePermission('billing.view');
  const active = await getActiveProject(ctx.user.id);
  const data = await getReceivables(active.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Money owed to us"
        description={`Every instalment still outstanding, oldest first. ${active.name}.`}
      />
      <ReceivablesView {...data} />
    </div>
  );
}
