import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { PageHeader } from '@/components/layout/page-header';
import { findDuplicateGroups } from '@/server/services/duplicate-service';
import { DuplicatesView } from '@/components/sales/duplicates-view';

export const metadata: Metadata = { title: 'Duplicate leads' };

export default async function DuplicatesPage() {
  const ctx = await requirePermission('lead.view');
  const groups = await findDuplicateGroups();
  return (
    <div className="max-w-4xl">
      <PageHeader title="Duplicate leads" description="Same phone or email captured more than once — merge them to keep history in one place." />
      <DuplicatesView groups={groups} canMerge={can(ctx.permissions, 'lead.delete')} />
    </div>
  );
}
