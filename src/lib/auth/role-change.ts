export const ROLE_ORDER = [
  'SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD', 'MANAGER',
  'EXECUTIVE', 'EMPLOYEE', 'READ_ONLY', 'GUEST',
] as const;
export type RoleValue = (typeof ROLE_ORDER)[number];

export interface RoleChangeRequest {
  actorId: string;
  actorRole: string;
  targetId: string;
  targetRole: string;
  newRole: string;
  /** Active super admins other than the target. */
  otherSuperAdmins: number;
}

/**
 * May `actorRole` create/assign an account with `newRole`? (F-05)
 * A SUPER_ADMIN may assign any role; everyone else may only assign a role
 * strictly below their own rank — so an ADMIN can never mint an ADMIN or
 * SUPER_ADMIN via the create-user path that bypasses checkRoleChange.
 */
export function canAssignRole(actorRole: string, newRole: string): boolean {
  if (!ROLE_ORDER.includes(newRole as RoleValue)) return false;
  if (actorRole === 'SUPER_ADMIN') return true;
  const ai = ROLE_ORDER.indexOf(actorRole as RoleValue);
  const ni = ROLE_ORDER.indexOf(newRole as RoleValue);
  return ai >= 0 && ni > ai; // strictly lower privilege than the actor
}

/**
 * May this role change go ahead?
 *
 * Kept separate from the database work so the rules can be tested directly.
 * A role change is the one edit that can hand over the whole system or lock
 * everybody out of it, and "it looked right when I read it" is not good enough
 * for that.
 */
export function checkRoleChange(r: RoleChangeRequest): { ok: true } | { error: string } {
  if (r.actorRole !== 'SUPER_ADMIN') {
    return { error: 'Only a super admin can change somebody\'s role.' };
  }
  if (!ROLE_ORDER.includes(r.newRole as RoleValue)) {
    return { error: 'That is not a role.' };
  }
  // A mis-click must not demote the only person able to undo it.
  if (r.actorId === r.targetId) {
    return { error: 'You cannot change your own role. Ask another super admin to do it.' };
  }
  // Granting a role above your own is impossible here by construction — only a
  // super admin may act, and super admin is the highest role. The check stays
  // so that widening who may act cannot quietly widen what they may grant.
  if (ROLE_ORDER.indexOf(r.newRole as RoleValue) < ROLE_ORDER.indexOf(r.actorRole as RoleValue)) {
    return { error: 'You cannot give somebody a role higher than your own.' };
  }
  // There must always remain somebody who can put things right.
  if (r.targetRole === 'SUPER_ADMIN' && r.newRole !== 'SUPER_ADMIN' && r.otherSuperAdmins === 0) {
    return { error: 'This is the only super admin. Make somebody else a super admin first, then change this one.' };
  }
  return { ok: true };
}


/**
 * May `actorRole` perform an account-altering action (suspend, force a reset,
 * issue a temporary password) against `targetRole`?
 *
 * Holding `admin.user.manage` is NOT sufficient on its own. Issuing a temporary
 * password returns the plaintext to the actor, which is functionally the power
 * to sign in as the target — so an ADMIN able to do that to a SUPER_ADMIN owns
 * the system. The same reasoning applies to disabling accounts (lockout).
 * You may only act on someone strictly below your own rank; a SUPER_ADMIN may
 * act on other super admins but never on themselves through these paths.
 */
export function canActOnUser(actorRole: string, targetRole: string): boolean {
  const ai = ROLE_ORDER.indexOf(actorRole as RoleValue);
  const ti = ROLE_ORDER.indexOf(targetRole as RoleValue);
  if (ai < 0 || ti < 0) return false;
  if (actorRole === 'SUPER_ADMIN') return true;
  return ti > ai; // strictly lower privilege than the actor
}
