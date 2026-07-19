import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { readSession } from './session';
import { resolvePermissions, can } from '@/lib/rbac/can';
import type { AuthContext, SafeUser } from '@/types/auth';
import type { PermissionKey } from '@/lib/rbac/permissions';

/** Resolve the authenticated user + permissions for the current request. */
export const getCurrentUser = cache(async (): Promise<AuthContext | null> => {
  const session = await readSession();
  if (!session) return null;
  if (session.user.status !== 'ACTIVE') return null;

  const { passwordHash: _p, twoFactorSecret: _t, ...safe } = session.user;
  const permissions = await resolvePermissions(session.user);
  return { user: safe as SafeUser, permissions, sessionId: session.id };
});

/** Guard for server components/actions — redirects unauthenticated users. */
export async function requireAuth(): Promise<AuthContext> {
  const ctx = await getCurrentUser();
  if (!ctx) redirect('/login');
  // Note: forced password change is steered from the login/2FA actions to
  // /settings/security?force=1. We intentionally do NOT redirect here to avoid
  // a loop on the security page itself.
  return ctx;
}

/** Guard requiring a specific permission. Redirects to a 403 page if denied. */
export async function requirePermission(key: PermissionKey): Promise<AuthContext> {
  const ctx = await requireAuth();
  if (!can(ctx.permissions, key)) redirect('/forbidden');
  return ctx;
}

export async function hasPermission(key: PermissionKey): Promise<boolean> {
  const ctx = await getCurrentUser();
  return ctx ? can(ctx.permissions, key) : false;
}
