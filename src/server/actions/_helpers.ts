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
  // Hard seal on REAL data for guest accounts. Every mutation in the app funnels
  // through here (directly or via `ensure`), so a GUEST can never touch company
  // records, no matter how the request is crafted or what permissions are set.
  //
  // Guests are not read-only overall — they can create and edit freely inside
  // their sandbox. Those actions live in `actions/sandbox.ts` and deliberately
  // do NOT call this helper: they resolve the caller's own sandbox and write
  // only to Sandbox* tables. So this stays an unconditional refusal.
  // Sign-out is exempt because it reads the session directly, not this helper.
  if (ctx.user.role === 'GUEST') {
    throw new ForbiddenError('Demo accounts cannot change real company data. Everything in your demo workspace is yours to edit.');
  }
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

/**
 * The failure half of every action result.
 *
 * `error` is the summary a toast shows; `fields` maps field name to message
 * when the failure was validation, so a form can render each one next to the
 * input it belongs to. Actions declare their result as
 * `{ ok: true } | ActionFailure` so a caller can reach `fields` without a cast.
 */
export type ActionFailure = { error: string; fields?: Record<string, string> };

/**
 * Normalize an unknown error into a user-safe message.
 *
 * `fields` is present only for a validation failure, and maps field name to the
 * message for that field, so a form can render it inline via `<Field error=…>`.
 */
export function toActionError(err: unknown): ActionFailure {
  if (err instanceof ForbiddenError) return { error: 'You do not have permission to do that.' };
  if (err instanceof AuthError) return { error: 'Your session expired. Please sign in again.' };
  if (err instanceof ZodError) {
    /*
     * Two shapes from one error, deliberately.
     *
     * `error` is the summary a toast shows, and is what every existing caller
     * reads — so this stays backwards compatible.
     *
     * `fields` is the same information keyed by field name, so a form can put
     * each message next to the input it belongs to. Without it a fifteen-field
     * form rejects with one toast reading "Pan: invalid  •  Ifsc: invalid" and
     * the person has to work out which of fifteen boxes those refer to, on a
     * form that has by then scrolled. The toast is not wrong, it is just not
     * where the problem is.
     */
    const fields: Record<string, string> = {};
    for (const i of err.issues) {
      const key = i.path.join('.');
      // First message per field: Zod can raise several for one input, and the
      // first is the one that failed earliest and is usually the actionable one.
      if (key && !fields[key]) fields[key] = i.message;
    }
    const msg = err.issues.map((i) => {
      const f = i.path.join('.'); const label = f ? f.charAt(0).toUpperCase() + f.slice(1) : 'Field';
      return `${label}: ${i.message}`;
    }).join('  •  ');
    return { error: msg || 'Please check the form and try again.', fields };
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
    // F-26: do NOT return the raw exception message to the client — Prisma and
    // runtime errors leak table/column names and internal detail. Log server-side,
    // show a generic message. (The migration-drift case above stays friendly.)
    console.error('[action:error]', m);
    return { error: 'Something went wrong. Please try again.' };
  }
  return { error: 'Something went wrong. Please try again.' };
}
