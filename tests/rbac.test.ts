import { describe, it, expect } from 'vitest';
import { expandRolePermissions, ROLE_DEFAULTS } from '@/lib/rbac/roles';
import { ALL_PERMISSION_KEYS } from '@/lib/rbac/permissions';

describe('RBAC role expansion', () => {
  it('expands the "*" wildcard to every permission', () => {
    expect(expandRolePermissions(['*']).length).toBe(ALL_PERMISSION_KEYS.length);
  });
  it('expands module wildcards', () => {
    const keys = expandRolePermissions(['task.*']);
    expect(keys.every((k) => k.startsWith('task.'))).toBe(true);
    expect(keys).toContain('task.create');
  });
  it('gives READ_ONLY only view permissions', () => {
    const keys = expandRolePermissions(ROLE_DEFAULTS.READ_ONLY);
    expect(keys).toContain('task.view');
    expect(keys).not.toContain('task.create');
  });
  it('never grants admin.role.manage to EMPLOYEE', () => {
    expect(expandRolePermissions(ROLE_DEFAULTS.EMPLOYEE)).not.toContain('admin.role.manage');
  });
});
