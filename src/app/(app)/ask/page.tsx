import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { AskView } from '@/components/ask/ask-view';

export const metadata: Metadata = { title: 'Ask your documents' };
export const dynamic = 'force-dynamic';

export default async function AskPage() {
  const ctx = await requirePermission('document.view');
  const [chunks, docs] = await Promise.all([
    prisma.docChunk.count(),
    prisma.docChunk.findMany({ distinct: ['fileObjectId'], select: { title: true }, take: 50 }),
  ]);
  return (
    <div>
      <PageHeader
        title="Ask your documents"
        description="Ask a question in plain English and get the answer with the passage it came from."
      />
      <AskView
        indexedChunks={chunks}
        indexedTitles={docs.map((d) => d.title)}
        canIndex={can(ctx.permissions, 'document.manage')}
      />
    </div>
  );
}
