import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { PageHeader } from '@/components/layout/page-header';
import { EXTRAS, EXTRA_CATEGORIES } from '@/config/marketplace';
import { installedExtras } from '@/server/actions/marketplace';
import { MarketplaceView } from '@/components/marketplace/marketplace-view';

export const metadata: Metadata = { title: 'Free extras' };
export const dynamic = 'force-dynamic';

export default async function MarketplacePage() {
  await requirePermission('admin.setting.manage');
  const installed = await installedExtras();
  return (
    <div>
      <PageHeader
        title="Free extras"
        description="Ready-made automations, templates, views and field sets. One click to add, one to remove, nothing to pay for."
      />
      <MarketplaceView extras={EXTRAS} categories={[...EXTRA_CATEGORIES]} installed={installed} />
    </div>
  );
}
