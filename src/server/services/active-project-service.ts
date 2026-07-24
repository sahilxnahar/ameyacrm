import 'server-only';
import { cache } from 'react';
import { prisma } from '@/lib/db/prisma';

export interface ActiveProject { id: string | null; name: string }

/**
 * Which project this person is working on.
 *
 * Read once per request and cached, because almost every page needs it. Null
 * means "all projects" — nobody is ever forced to pick, and a stale selection
 * pointing at a deleted project falls back to all rather than showing nothing.
 */
export const getActiveProject = cache(async (userId: string): Promise<ActiveProject> => {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { activeProjectId: true } });
  if (!u?.activeProjectId) return { id: null, name: 'All projects' };
  const p = await prisma.project.findFirst({
    where: { id: u.activeProjectId, isActive: true },
    select: { id: true, name: true },
  });
  return p ? { id: p.id, name: p.name } : { id: null, name: 'All projects' };
});

/**
 * A `where` fragment for anything with a projectId.
 *
 * Records with no project attached are always included — an unassigned lead
 * should not vanish because somebody picked a project.
 */
export function projectScope(activeId: string | null): Record<string, unknown> {
  if (!activeId) return {};
  return { OR: [{ projectId: activeId }, { projectId: null }] };
}

/** Strict version, for things that must belong to a project — units, floor plans. */
export function strictProjectScope(activeId: string | null): Record<string, unknown> {
  return activeId ? { projectId: activeId } : {};
}
