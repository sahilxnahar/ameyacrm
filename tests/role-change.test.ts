import { describe, it, expect } from 'vitest';
import { checkRoleChange } from '@/lib/auth/role-change';

const base = {
  actorId: 'boss', actorRole: 'SUPER_ADMIN',
  targetId: 'staff', targetRole: 'EMPLOYEE', newRole: 'MANAGER',
  otherSuperAdmins: 2,
};

describe('checkRoleChange', () => {
  it('lets a super admin promote somebody', () => {
    expect(checkRoleChange(base)).toEqual({ ok: true });
  });

  it('refuses anyone who is not a super admin', () => {
    for (const actorRole of ['ADMIN', 'DEPARTMENT_HEAD', 'MANAGER', 'EMPLOYEE']) {
      expect(checkRoleChange({ ...base, actorRole })).toHaveProperty('error');
    }
  });

  it('refuses a change to your own role', () => {
    expect(checkRoleChange({ ...base, targetId: 'boss' })).toHaveProperty('error');
  });

  it('refuses an invented role', () => {
    expect(checkRoleChange({ ...base, newRole: 'OWNER' })).toHaveProperty('error');
  });

  it('protects the last super admin', () => {
    const r = checkRoleChange({ ...base, targetRole: 'SUPER_ADMIN', newRole: 'ADMIN', otherSuperAdmins: 0 });
    expect(r).toHaveProperty('error');
    expect('error' in r && r.error).toContain('only super admin');
  });

  it('allows demoting a super admin when another one remains', () => {
    expect(checkRoleChange({ ...base, targetRole: 'SUPER_ADMIN', newRole: 'ADMIN', otherSuperAdmins: 1 })).toEqual({ ok: true });
  });

  it('allows making a second super admin', () => {
    expect(checkRoleChange({ ...base, newRole: 'SUPER_ADMIN' })).toEqual({ ok: true });
  });
});
