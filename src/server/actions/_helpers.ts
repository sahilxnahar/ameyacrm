import 'server-only';
import { getCurrentUser } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import type { AuthContext } from '@/types/auth';
import type { PermissionKey } from '@/lib/rbac/permissions';

export class AuthError extends Error {}
export class ForbiddenError extends Error {}

/** Get the auth context inside a server action, or throw. */
export async function getActionContext(): Promise<AuthContext> {
  const ctx = await getCurrentUser();
  if (!ctx) throw new AuthError('You must be signed in.');
  return ctx;
}

/** Assert a permission inside a server action, or throw ForbiddenError. */
export async function ensure(permission: PermissionKey): Promise<AuthContext> {
  const ctx = await getActionContext();
  if (!can(ctx.permissions, permission)) {
    throw new ForbiddenError(`Missing permission: ${permission}`);
  }
  return ctx;
}

/** Normalize an unknown error into a user-safe message. */
export function toActionError(err: unknown): { error: string } {
  if (err instanceof ForbiddenError) return { error: 'You do not have permission to do that.' };
  if (err instanceof AuthError) return { error: 'Your session expired. Please sign in again.' };
  if (err instanceof Error) return { error: err.message };
  return { error: 'Something went wrong. Please try again.' };
}
