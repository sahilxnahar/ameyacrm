import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { prisma } from '@/lib/db/prisma';
import { ROLE_LABELS } from '@/lib/rbac/roles';
import { isGeminiEnabled } from '@/lib/ai/gemini';
import { isDriveConfigured } from '@/lib/google/drive';
import { PageHeader } from '@/components/layout/page-header';
import { DocumentsView } from '@/components/documents/documents-view';

export const metadata: Metadata = { title: 'Documents' };

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ folder?: string }> }) {
  const ctx = await requirePermission('document.view');
  const { folder } = await searchParams;
  const folderId = folder ?? null;
  const allFolders = await prisma.folder.findMany({ where: { deletedAt: null }, select: { id: true, name: true }, orderBy: { name: 'asc' }, take: 500 });
  const canManage = can(ctx.permissions, 'document.manage');

  const [current, folders, documents, projects, perms, users, departments] = await Promise.all([
    folderId ? prisma.folder.findUnique({ where: { id: folderId } }) : null,
    prisma.folder.findMany({ where: { parentId: folderId, deletedAt: null }, orderBy: { name: 'asc' }, include: { _count: { select: { documents: true, children: true } } } }),
    prisma.document.findMany({ where: { folderId: folderId ?? undefined, deletedAt: null }, orderBy: { updatedAt: 'desc' }, include: { versions: { orderBy: { version: 'desc' }, take: 1, include: { file: true } }, owner: { select: { name: true } }, _count: { select: { versions: true } } } }),
    prisma.project.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
    folderId ? prisma.folderPermission.findMany({ where: { folderId }, include: { user: { select: { name: true } }, department: { select: { name: true } } } }) : Promise.resolve([]),
    canManage ? prisma.user.findMany({ where: { status: 'ACTIVE' }, select: { id: true, name: true }, orderBy: { name: 'asc' } }) : Promise.resolve([]),
    canManage ? prisma.department.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }) : Promise.resolve([]),
  ]);

  const crumbs: { id: string; name: string }[] = [];
  if (current) {
    const ids = current.path.split('/').filter(Boolean);
    if (ids.length) {
      const parents = await prisma.folder.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
      const byId = new Map(parents.map((p) => [p.id, p.name] as const));
      ids.forEach((pid) => byId.has(pid) && crumbs.push({ id: pid, name: byId.get(pid)! }));
    }
    crumbs.push({ id: current.id, name: current.name });
  }

  return (
    <div>
      <PageHeader title="Document Control" description="Versioned, permissioned, searchable document library." />
      <DocumentsView
        allFolders={allFolders.map((f) => ({ id: f.id, name: f.name }))}
        folderId={folderId}
        folderName={current?.name ?? 'Library'}
        crumbs={crumbs}
        projects={projects}
        canManage={canManage}
        geminiEnabled={isGeminiEnabled()}
        driveEnabled={isDriveConfigured()}
        users={users}
        departments={departments}
        permissions={perms.map((p) => ({
          id: p.id, level: p.level,
          kind: p.userId ? 'User' : p.departmentId ? 'Dept' : 'Role',
          who: p.user?.name ?? p.department?.name ?? (p.role ? ROLE_LABELS[p.role] : '—'),
        }))}
        folders={folders.map((f) => ({ id: f.id, name: f.name, visibility: f.visibility, docs: f._count.documents, subfolders: f._count.children }))}
        documents={documents.map((d) => ({ id: d.id, title: d.title, versions: d._count.versions, owner: d.owner?.name ?? null, updatedAt: d.updatedAt.toISOString(), expiresAt: d.expiresAt ? d.expiresAt.toISOString() : null, fileId: d.versions[0]?.file.id ?? null, size: d.versions[0]?.file.size ?? null, mime: d.versions[0]?.file.mimeType ?? null, summary: d.versions[0]?.file.ocrText ?? null, driveUrl: d.versions[0]?.file.driveUrl ?? null }))}
      />
    </div>
  );
}
