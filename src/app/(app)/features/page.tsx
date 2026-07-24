import type { Metadata } from 'next';
import { requireAuth } from '@/lib/auth/current-user';
import { PageHeader } from '@/components/layout/page-header';
import { FeatureExplorer } from '@/components/features/feature-explorer';

export const metadata: Metadata = { title: 'Explore Features' };
export const dynamic = 'force-dynamic';

export default async function FeaturesPage() {
  const { permissions } = await requireAuth();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Explore Features"
        description="Everything Ameya Heights CRM can do, in one place — grouped by area, with a plain-language line on each. Search to find it, click to open it."
      />
      <FeatureExplorer allowed={[...permissions.keys]} isSuperAdmin={permissions.isSuperAdmin} />
    </div>
  );
}
