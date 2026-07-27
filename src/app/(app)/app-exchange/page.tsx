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
        description={`A directory of ${CONNECTOR_COUNT} apps across ${CONNECTOR_CATEGORIES.length} categories. About 16 work end-to-end today — messaging (Slack, Discord, Telegram), Razorpay, WhatsApp, the property portals, and Gmail/Sheets/Drive via your Apps Script connector. The rest are marked "Not built yet": tell us which you need and we build it for real, one at a time.`}
      />
      <AppExchange connectors={CONNECTORS} categories={CONNECTOR_CATEGORIES} installs={installs} />
    </div>
  );
}
