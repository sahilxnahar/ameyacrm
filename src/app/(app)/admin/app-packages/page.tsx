import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { PageHeader } from '@/components/layout/page-header';
import { APP_PACKAGES } from '@/config/app-packages';
import { installedPackages } from '@/server/actions/app-packages';
import { AppPackagesView } from '@/components/exchange/app-packages-view';

export const metadata: Metadata = { title: 'App Packages' };
export const dynamic = 'force-dynamic';

export default async function AppPackagesPage() {
  await requirePermission('admin.setting.manage');
  const installed = await installedPackages();
  return (
    <div className="space-y-6">
      <PageHeader
        title="App Packages"
        description="Install ready-made bundles of fields, automations, views and connectors in one click — or author your own, export it as JSON, and share it. This is how you reshape the CRM for your team without code."
      />
      <AppPackagesView packages={APP_PACKAGES} installed={installed} />
    </div>
  );
}
