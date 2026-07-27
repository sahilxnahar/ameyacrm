import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { PageHeader } from '@/components/layout/page-header';
import { EmailHealthView } from '@/components/admin/email-health-view';

export const metadata: Metadata = { title: 'Email health' };
export const dynamic = 'force-dynamic';

export default async function EmailHealthPage() {
  const ctx = await requirePermission('admin.setting.manage');
  return (
    <div className="space-y-6">
      <PageHeader
        title="Email health"
        description="Check whether outbound email (password resets, 2FA codes, alerts) is actually being delivered — and get told exactly what to fix if not."
      />
      <EmailHealthView defaultTo={ctx.user.email} />
    </div>
  );
}
