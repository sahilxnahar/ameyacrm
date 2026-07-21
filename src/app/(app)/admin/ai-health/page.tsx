import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { AiHealthView } from '@/components/admin/ai-health-view';

export const metadata: Metadata = { title: 'AI health' };
export const dynamic = 'force-dynamic';

export default async function AiHealthPage() {
  await requirePermission('admin.setting.manage');

  const [indexed, summarised, docs] = await Promise.all([
    prisma.docChunk.count().catch(() => 0),
    prisma.fileObject.count({ where: { ocrText: { not: null } } }).catch(() => 0),
    prisma.fileObject.count().catch(() => 0),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI health"
        description="Runs the AI for real and shows you exactly what came back. Nothing here is guessed from settings."
      />
      <AiHealthView indexed={indexed} summarised={summarised} docs={docs} />
    </div>
  );
}
