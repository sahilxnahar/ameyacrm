import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { PROVIDERS } from '@/config/providers';
import { ConnectionsView } from '@/components/admin/connections-view';

export const metadata: Metadata = { title: 'Connected accounts' };
export const dynamic = 'force-dynamic';

export default async function ConnectionsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requirePermission('admin.setting.manage');
  const { ok, error } = await searchParams;

  const rows = await prisma.integrationConnection.findMany().catch(() => []);
  const byProvider = new Map(rows.map((r) => [r.provider, r]));

  const providers = PROVIDERS.map((p) => {
    const c = byProvider.get(p.key);
    // WhatsApp can also be wired up with a pasted System User token, which
    // bypasses OAuth entirely — say so rather than showing it as unconfigured.
    const viaToken = p.key === 'whatsapp' && Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
    const hasCredentials = viaToken || Boolean(process.env[p.clientIdEnv] && process.env[p.clientSecretEnv]);
    const expired = c?.expiresAt ? c.expiresAt.getTime() < Date.now() : false;
    return {
      key: p.key, name: p.name, what: p.what, group: p.group,
      prerequisites: p.prerequisites, cost: p.cost, docs: p.docs,
      clientIdEnv: p.clientIdEnv, clientSecretEnv: p.clientSecretEnv,
      hasCredentials,
      status: viaToken ? 'CONNECTED' : !hasCredentials ? 'NEEDS_SETUP' : expired ? 'EXPIRED' : (c?.status ?? 'DISCONNECTED'),
      accountName: viaToken ? `Connected with a System User token · number ${process.env.WHATSAPP_PHONE_NUMBER_ID}` : c?.accountName ?? null,
      connectedAt: c?.connectedAt?.toISOString() ?? null,
      lastError: c?.lastError ?? null,
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Connected accounts"
        description="WhatsApp, Meta and Google Ads. Register the app once, then connecting is just a login."
      />
      <ConnectionsView providers={providers} flashOk={ok ?? null} flashError={error ?? null} />
    </div>
  );
}
