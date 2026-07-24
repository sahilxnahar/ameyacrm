import 'server-only';
import { cache } from 'react';
import { prisma } from '@/lib/db/prisma';
import { can } from '@/lib/rbac/can';
import type { AuthContext } from '@/types/auth';

export interface FolderNode {
  id: string;
  name: string;
  parentId: string | null;
  documentCount: number;
  canOpen: boolean;          // may see what is inside
  restricted: boolean;       // has explicit permissions set
  reason?: string;           // why it is locked, for the tooltip
}

/**
 * Which folders this person may open.
 *
 * Every folder is listed for everyone — the structure of the business is not
 * a secret, and a folder that silently vanishes makes people think documents
 * have been lost. What is inside is a different matter: a restricted folder
 * appears with a padlock and refuses to open.
 */
export const getFolderTree = cache(async (ctx: AuthContext): Promise<FolderNode[]> => {
  const [folders, perms, counts] = await Promise.all([
    prisma.folder.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, parentId: true },
      orderBy: { name: 'asc' },
    }),
    prisma.folderPermission.findMany({
      select: { folderId: true, userId: true, departmentId: true, role: true, level: true },
    }),
    prisma.document.groupBy({ by: ['folderId'], where: { deletedAt: null }, _count: { _all: true } }),
  ]);

  const me = await prisma.user.findUnique({ where: { id: ctx.user.id }, select: { departmentId: true, role: true } });
  const countOf = new Map(counts.filter((c) => c.folderId).map((c) => [c.folderId as string, c._count._all]));
  const seesEverything = can(ctx.permissions, 'document.manage');

  const byFolder = new Map<string, typeof perms>();
  for (const p of perms) {
    byFolder.set(p.folderId, [...(byFolder.get(p.folderId) ?? []), p]);
  }

  const decide = (folderId: string): { canOpen: boolean; restricted: boolean; reason?: string } => {
    const rules = byFolder.get(folderId);
    if (!rules?.length) return { canOpen: true, restricted: false };
    if (seesEverything) return { canOpen: true, restricted: true };

    const allowed = rules.some((r) =>
      (r.userId && r.userId === ctx.user.id) ||
      (r.departmentId && r.departmentId === me?.departmentId) ||
      (r.role && r.role === me?.role));

    return allowed
      ? { canOpen: true, restricted: true }
      : { canOpen: false, restricted: true, reason: 'Restricted — ask an administrator for access' };
  };

  // A locked parent locks everything beneath it, however the child is configured.
  const nodes = new Map<string, FolderNode>();
  for (const f of folders) {
    const d = decide(f.id);
    nodes.set(f.id, {
      id: f.id, name: f.name, parentId: f.parentId,
      documentCount: countOf.get(f.id) ?? 0,
      canOpen: d.canOpen, restricted: d.restricted, reason: d.reason,
    });
  }
  for (const node of nodes.values()) {
    let p = node.parentId;
    for (let depth = 0; depth < 8 && p; depth++) {
      const parent = nodes.get(p);
      if (!parent) break;
      if (!parent.canOpen) {
        node.canOpen = false;
        node.restricted = true;
        node.reason = node.reason ?? `Inside ${parent.name}, which is restricted`;
        break;
      }
      p = parent.parentId;
    }
  }

  return [...nodes.values()];
});
/** Guard for anything that reads a folder's contents. */
export async function canOpenFolder(ctx: AuthContext, folderId: string | null): Promise<boolean> {
  if (!folderId) return true;
  const tree = await getFolderTree(ctx);
  return tree.find((f) => f.id === folderId)?.canOpen ?? true;
}

/** Folder ids this person may not read — used to filter document lists. */
export async function lockedFolderIds(ctx: AuthContext): Promise<string[]> {
  const tree = await getFolderTree(ctx);
  return tree.filter((f) => !f.canOpen).map((f) => f.id);
}
