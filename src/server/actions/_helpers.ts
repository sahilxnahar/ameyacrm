import { ZodError } from 'zod';
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
  if (err instanceof ZodError) {
    const msg = err.issues.map((i) => {
      const f = i.path.join('.'); const label = f ? f.charAt(0).toUpperCase() + f.slice(1) : 'Field';
      return `${label}: ${i.message}`;
    }).join('  •  ');
    return { error: msg || 'Please check the form and try again.' };
  }
  if (err instanceof Error) {
    // The commonest real cause of a mystery failure is code that is newer than
    // the database. Say that outright instead of "please try again", which
    // sends people round in circles.
    const m = err.message;
    if (/column .* does not exist|Unknown argument|does not exist in the current database|relation ".*" does not exist/i.test(m)) {
      const col = m.match(/column [`"]?([\w.]+)[`"]?/i)?.[1];
      return {
        error:
          `The database is missing ${col ? `"${col}"` : 'something this version needs'}. ` +
          'The code has been deployed but the migration has not been run yet — open Neon and run the MIGRATION SQL for this version, then reload.',
      };
    }
    return { error: m };
  }
  return { error: 'Something went wrong. Please try again.' };
}
