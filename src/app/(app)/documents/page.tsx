import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requirePermission } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { getFolderTree } from '@/server/services/folder-access-service';
import { DriveBrowser } from '@/components/documents/drive-browser';

export const metadata: Metadata = { title: 'Documents' };
export const dynamic = 'force-dynamic';

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ folder?: string }> }) {
  const ctx = await requirePermission('document.view');
  const { folder } = await searchParams;
  const folderId = folder ?? null;

  const tree = await getFolderTree(ctx);
  const access = new Map(tree.map((t) => [t.id, t]));
  if (folderId && access.get(folderId)?.canOpen === false) redirect('/documents');

  const documents = await prisma.document.findMany({
    where: { folderId: folderId ?? undefined, deletedAt: null },
    orderBy: { updatedAt: 'desc' },
    take: 300,
    select: {
      id: true, title: true, updatedAt: true,
      owner: { select: { name: true } },
      versions: {
        orderBy: { version: 'desc' }, take: 1,
        select: { file: { select: { id: true, originalName: true, mimeType: true, size: true, driveUrl: true } } },
      },
    },
  });

  // Breadcrumbs, walking up from wherever we are.
  const crumbs: { id: string; name: string }[] = [];
  let cur = folderId;
  for (let i = 0; i < 10 && cur; i++) {
    const node = access.get(cur);
    if (!node) break;
    crumbs.unshift({ id: node.id, name: node.name });
    cur = node.parentId;
  }

  return (
    <div>
      <PageHeader
        title={crumbs.at(-1)?.name ?? 'Documents'}
        description="Everything the company has filed. Drag files onto a folder to move them; anything added in Google Drive turns up here too."
      />
      <DriveBrowser
        tree={tree.map((t) => ({
          id: t.id, name: t.name, parentId: t.parentId,
          documentCount: t.documentCount, canOpen: t.canOpen, reason: t.reason,
        }))}
        documents={documents.map((d) => {
          const f = d.versions[0]?.file ?? null;
          return {
            id: d.id, title: d.title,
            fileId: f?.id ?? null, fileName: f?.originalName ?? null,
            mimeType: f?.mimeType ?? null, size: f?.size ?? 0,
            driveUrl: f?.driveUrl ?? null,
            ownerName: d.owner?.name ?? null,
            updatedAt: d.updatedAt.toISOString(),
          };
        })}
        crumbs={crumbs}
        currentId={folderId}
        canManage={can(ctx.permissions, 'document.manage')}
        canUpload={can(ctx.permissions, 'document.create')}
      />
    </div>
  );
}
