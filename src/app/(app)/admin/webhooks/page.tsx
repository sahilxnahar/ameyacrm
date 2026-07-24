import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { WebhooksView } from '@/components/admin/webhooks-view';

export const metadata: Metadata = { title: 'Webhooks' };
export const dynamic = 'force-dynamic';

export default async function WebhooksPage() {
  await requirePermission('admin.setting.manage');
  const hooks = await prisma.webhook.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }).catch(() => []);
  return (
    <div className="max-w-3xl">
      <PageHeader title="Webhooks" description="Push CRM activity to Zapier, Make or any system in real time. Pick the events you care about and we POST a signed JSON payload to your URL each time one happens." />
      <WebhooksView
        hooks={hooks.map((h) => ({
          id: h.id, url: h.url, events: h.events, isActive: h.isActive, description: h.description,
          source: h.source, lastStatus: h.lastStatus, lastError: h.lastError,
          lastDeliveryAt: h.lastDeliveryAt?.toISOString() ?? null, failureCount: h.failureCount,
        }))}
      />
    </div>
  );
}
