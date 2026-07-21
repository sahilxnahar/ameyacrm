import 'server-only';
import { cache } from 'react';
import { prisma } from '@/lib/db/prisma';
import { resolvePermissions } from '@/lib/rbac/can';

/**
 * One access context for every subsystem (I5 — the safety rail). As features
 * multiply, the danger is each one re-deriving "who is this, what may they see,
 * which departments and project are they scoped to" in its own way — and getting
 * it subtly wrong. This resolves it *once*, consistently, and is `cache()`d per
 * request so calling it from several places costs one lookup.
 */
export interface AccessContext {
  userId: string;
  role: string;
  isSuperAdmin: boolean;
  permissionKeys: Set<string>;
  /** Every department the person belongs to (main + extras). */
  departmentIds: string[];
  activeProjectId: string | null;
}

export const getAccessContext = cache(async (userId: string): Promise<AccessContext> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, activeProjectId: true, departmentId: true, extraDepartments: { select: { departmentId: true } } },
  });
  if (!user) throw new Error('Access context: user not found');
  const perms = await resolvePermissions({ id: user.id, role: user.role });
  const departmentIds = [...new Set([user.departmentId, ...user.extraDepartments.map((e) => e.departmentId)].filter((x): x is string => Boolean(x)))];
  return {
    userId: user.id,
    role: user.role,
    isSuperAdmin: perms.isSuperAdmin,
    permissionKeys: perms.keys,
    departmentIds,
    activeProjectId: user.activeProjectId ?? null,
  };
});

/** Does this person have a permission? The one place that answers it for any subsystem. */
export function accessCan(ctx: AccessContext, key: string): boolean {
  return ctx.isSuperAdmin || ctx.permissionKeys.has('*') || ctx.permissionKeys.has(key);
}

/** Is this person a member of the given department? */
export function inDepartment(ctx: AccessContext, departmentId: string | null | undefined): boolean {
  return Boolean(departmentId) && ctx.departmentIds.includes(departmentId as string);
}
