import type { Metadata } from 'next';
import { requireAuth } from '@/lib/auth/current-user';
import { PageHeader } from '@/components/layout/page-header';
import { GuideView } from '@/components/guide/guide-view';

export const metadata: Metadata = { title: 'Guide' };
export const dynamic = 'force-dynamic';

export default async function GuidePage() {
  const { user, permissions } = await requireAuth();
  const firstName = user.name.split(' ')[0];
  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome${firstName ? `, ${firstName}` : ''} — your CRM guide`}
        description="Everything you need to get going and use Ameya Heights CRM well: first steps, how to make it yours, and a walk through every area and feature. Search anytime."
      />
      <GuideView allowed={[...permissions.keys]} isSuperAdmin={permissions.isSuperAdmin} />
    </div>
  );
}
