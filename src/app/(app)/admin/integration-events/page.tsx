import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { IntegrationBusView } from '@/components/admin/integration-bus-view';

export const metadata: Metadata = { title: 'Integration Events' };
export const dynamic = 'force-dynamic';

export default async function IntegrationEventsPage() {
  await requirePermission('admin.setting.manage');
  const [events, pending, done, failed, iotCount] = await Promise.all([
    prisma.webhookEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }).catch(() => []),
    prisma.webhookEvent.count({ where: { status: 'PENDING' } }).catch(() => 0),
    prisma.webhookEvent.count({ where: { status: 'DONE' } }).catch(() => 0),
    prisma.webhookEvent.count({ where: { status: 'FAILED' } }).catch(() => 0),
    prisma.iotReading.count().catch(() => 0),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title="Integration Events" description="The async event bus (#50). Every third-party webhook — Razorpay, WhatsApp, IoT — lands here, is acked instantly, and is processed out-of-band so the CRM never blocks." />
      <IntegrationBusView
        counts={{ pending, done, failed, iot: iotCount }}
        events={events.map((e) => ({ id: e.id, provider: e.provider, type: e.type, status: e.status, externalId: e.externalId, retryCount: e.retryCount, error: e.errorMessage, at: e.createdAt.toISOString() }))}
      />
    </div>
  );
}
