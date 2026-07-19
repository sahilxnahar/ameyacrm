import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { ApiTokensView } from '@/components/admin/api-tokens-view';

export const metadata: Metadata = { title: 'API Tokens' };

export default async function ApiTokensPage() {
  await requirePermission('admin.setting.manage');
  const tokens = await prisma.apiToken.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  return (
    <div className="max-w-3xl">
      <PageHeader title="API tokens" description="Let other systems read your CRM data securely." />
      <ApiTokensView tokens={tokens.map((t) => ({ id: t.id, name: t.name, prefix: t.prefix, createdAt: t.createdAt.toISOString(), lastUsedAt: t.lastUsedAt?.toISOString() ?? null, revoked: !!t.revokedAt }))} />
    </div>
  );
}
