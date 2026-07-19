import 'server-only';
import type { RoleName, User } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { expandRolePermissions, ROLE_DEFAULTS } from './roles';
import type { PermissionKey } from './permissions';

export interface PermissionSet {
  role: RoleName;
  keys: Set<string>;
  isSuperAdmin: boolean;
}

/**
 * Resolve the effective permission set for a user:
 *   1. Start from seeded RolePermission rows (falls back to code defaults).
 *   2. Apply DENY rows (remove) then ALLOW rows.
 *   3. Apply per-user UserPermission overrides (DENY wins over ALLOW).
 * SUPER_ADMIN short-circuits to "all".
 */
export async function resolvePermissions(user: Pick<User, 'id' | 'role'>): Promise<PermissionSet> {
  if (user.role === 'SUPER_ADMIN') {
    return { role: user.role, keys: new Set(['*']), isSuperAdmin: true };
  }

  const [roleRows, userRows] = await Promise.all([
    prisma.rolePermission.findMany({
      where: { role: user.role },
      include: { permission: { select: { key: true } } },
    }),
    prisma.userPermission.findMany({
      where: { userId: user.id },
      include: { permission: { select: { key: true } } },
    }),
  ]);

  const keys = new Set<string>();
  if (roleRows.length === 0) {
    // No DB config yet → use code defaults so the app is never "locked out".
    expandRolePermissions(ROLE_DEFAULTS[user.role]).forEach((k) => keys.add(k));
  } else {
    for (const r of roleRows) if (r.effect === 'ALLOW') keys.add(r.permission.key);
    for (const r of roleRows) if (r.effect === 'DENY') keys.delete(r.permission.key);
  }
  // User overrides take precedence.
  for (const r of userRows) if (r.effect === 'ALLOW') keys.add(r.permission.key);
  for (const r of userRows) if (r.effect === 'DENY') keys.delete(r.permission.key);

  return { role: user.role, keys, isSuperAdmin: false };
}

export function can(perms: PermissionSet, key: PermissionKey | string): boolean {
  if (perms.isSuperAdmin || perms.keys.has('*')) return true;
  return perms.keys.has(key);
}

export function canAny(perms: PermissionSet, keys: (PermissionKey | string)[]): boolean {
  return keys.some((k) => can(perms, k));
}
