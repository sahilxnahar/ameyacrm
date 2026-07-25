import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { API_ENDPOINTS, API_GROUPS } from '@/lib/api/openapi';
import { ApiPlayground } from '@/components/developers/api-playground';

export const metadata: Metadata = { title: 'Developers' };
export const dynamic = 'force-dynamic';

export default async function DevelopersPage() {
  await requirePermission('admin.setting.manage');
  const tokens = await prisma.apiToken.findMany({
    where: { revokedAt: null }, orderBy: { createdAt: 'desc' }, take: 50,
    select: { id: true, name: true, prefix: true },
  }).catch(() => []);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Developers"
        description="Build on Ameya. Browse the REST API, try any endpoint live with your token, grab the OpenAPI spec, and test webhooks — all from here."
      />
      <ApiPlayground endpoints={API_ENDPOINTS} groups={API_GROUPS} tokens={tokens} />
    </div>
  );
}
