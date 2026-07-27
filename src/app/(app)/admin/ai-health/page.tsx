import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { AiHealthView } from '@/components/admin/ai-health-view';
import { indexCoverage } from '@/server/services/ai-index-service';
import { keyPool, activeProvider, fallbackProvider } from '@/lib/ai/provider';

export const metadata: Metadata = { title: 'AI health' };
export const dynamic = 'force-dynamic';

export default async function AiHealthPage() {
  await requirePermission('admin.setting.manage');

  const [indexed, summarised, docs, coverage] = await Promise.all([
    prisma.docChunk.count().catch(() => 0),
    prisma.fileObject.count({ where: { ocrText: { not: null } } }).catch(() => 0),
    prisma.fileObject.count().catch(() => 0),
    indexCoverage().catch(() => []),
  ]);

  // Read the real key pool server-side. Only the COUNT crosses to the client —
  // never the keys themselves. This lets an admin confirm how many spare keys
  // are actually loaded (e.g. four OpenRouter keys) without opening Vercel.
  const provider = activeProvider();
  const supply = {
    provider: provider.label,
    model: provider.model,
    keyCount: keyPool().length,
    hasFallback: Boolean(fallbackProvider()),
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI health"
        description="Runs the AI for real and shows you exactly what came back. Nothing here is guessed from settings."
      />
      <AiHealthView indexed={indexed} summarised={summarised} docs={docs} coverage={coverage} supply={supply} />
    </div>
  );
}
