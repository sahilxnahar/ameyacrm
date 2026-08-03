import { describe, it, expect } from 'vitest';
import { ROLE_DEFAULTS, expandRolePermissions } from '@/lib/rbac/roles';
import { ALL_PERMISSION_KEYS } from '@/lib/rbac/permissions';

/**
 * A permission granted to nobody is a screen nobody can open.
 *
 * Forty-two of the ninety-two keys were in exactly that state: defined, used to
 * guard around forty-five screens, and present in no role's defaults. Every one
 * of those screens redirected everybody except the Super Admin to /forbidden —
 * so the owner, signed in as Super Admin, saw a complete product while their
 * team could not reach half of it. That is what "there are so many sections
 * where I cannot add data" turned out to be.
 */
describe('role coverage', () => {
  const granted = new Set<string>();
  for (const role of Object.keys(ROLE_DEFAULTS) as (keyof typeof ROLE_DEFAULTS)[]) {
    if (role === 'SUPER_ADMIN') continue;   // '*' would hide the problem
    expandRolePermissions(ROLE_DEFAULTS[role]).forEach((k) => granted.add(k));
  }

  it('gives every permission to at least one role other than Super Admin', () => {
    // Deliberate exception: who may see the books is a Super Admin decision. An
    // Admin who could appoint themselves to the ledger is not a control.
    const DELIBERATE = new Set(['finance.access.manage']);
    const orphans = ALL_PERMISSION_KEYS.filter((k) => !granted.has(k) && !DELIBERATE.has(k));
    expect(orphans, `no role can use these, so the screens they guard are unreachable:\n${orphans.join('\n')}`).toEqual([]);
  });

  it('lets an Admin actually run the company', () => {
    const admin = new Set<string>(expandRolePermissions(ROLE_DEFAULTS.ADMIN));
    for (const k of ([ 'finance.ledger.view', 'finance.ledger.manage', 'land.view', 'treasury.view',
                     'programme.manage', 'quality.manage', 'procurement.manage', 'governance.manage',
                     'statutory.manage', 'esg.manage', 'knowledge.manage', 'capital.view'] as string[])) {
      expect(admin.has(k), `an Admin cannot ${k}`).toBe(true);
    }
  });

  it('still withholds what an Admin must not grant themselves', () => {
    const admin = new Set<string>(expandRolePermissions(ROLE_DEFAULTS.ADMIN));
    expect(admin.has('finance.access.manage')).toBe(false);
  });

  it('keeps a guest sealed', () => {
    expect(expandRolePermissions(ROLE_DEFAULTS.GUEST)).toEqual([]);
  });
});
