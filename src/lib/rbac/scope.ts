import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { can } from '@/lib/rbac/can';
import type { AuthContext } from '@/types/auth';

/** Self + everyone reporting up to this user (walks the hierarchy, max 5 levels). */
export async function teamUserIds(userId: string): Promise<string[]> {
  const ids = new Set<string>([userId]);
  let frontier = [userId];
  for (let depth = 0; depth < 5 && frontier.length; depth++) {
    const kids = await prisma.user.findMany({ where: { managerId: { in: frontier }, deletedAt: null }, select: { id: true } });
    frontier = kids.map((k) => k.id).filter((id) => !ids.has(id));
    frontier.forEach((id) => ids.add(id));
  }
  return [...ids];
}

/**
 * Lead visibility by hierarchy:
 *  - can assign leads (managers/admins) → everything
 *  - otherwise → own leads + those of anyone reporting to them
 */
export async function leadScope(ctx: AuthContext): Promise<Record<string, unknown>> {
  if (can(ctx.permissions, 'lead.assign')) return {};
  const ids = await teamUserIds(ctx.user.id);
  return ids.length > 1 ? { ownerId: { in: ids } } : { ownerId: ctx.user.id };
}
