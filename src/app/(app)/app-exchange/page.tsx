import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { PageHeader } from '@/components/layout/page-header';
import { CONNECTORS, CONNECTOR_CATEGORIES, CONNECTOR_COUNT, LIVE_CONNECTOR_COUNT } from '@/config/connectors';
import { connectorInstalls } from '@/server/actions/connectors';
import { AppExchange } from '@/components/exchange/app-exchange';

export const metadata: Metadata = { title: 'App Exchange' };
export const dynamic = 'force-dynamic';

export default async function AppExchangePage() {
  await requirePermission('admin.setting.manage');
  const installs = await connectorInstalls();
  return (
    <div className="space-y-6">
      <PageHeader
        title="App Exchange"
        description={`Connect Ameya to the tools you already use. ${CONNECTOR_COUNT} connectors across ${CONNECTOR_CATEGORIES.length} categories — ${LIVE_CONNECTOR_COUNT} live today, the rest installable as the framework provisions them.`}
      />
      <AppExchange connectors={CONNECTORS} categories={CONNECTOR_CATEGORIES} installs={installs} />
    </div>
  );
}
