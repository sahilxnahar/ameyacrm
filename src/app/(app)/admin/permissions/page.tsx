import type { Metadata } from 'next';
import type { RoleName } from '@prisma/client';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { ROLE_DEFAULTS, expandRolePermissions, ROLE_LABELS } from '@/lib/rbac/roles';
import { PageHeader } from '@/components/layout/page-header';
import { PermissionEditor } from '@/components/admin/permission-editor';

export const metadata: Metadata = { title: 'Roles & Permissions' };

export default async function PermissionsPage() {
  await requirePermission('admin.role.manage');
  const [permissions, roleRows] = await Promise.all([
    prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { key: 'asc' }] }),
    prisma.rolePermission.findMany({ where: { effect: 'ALLOW' }, include: { permission: { select: { key: true } } } }),
  ]);
  const roles: RoleName[] = ['ADMIN', 'DEPARTMENT_HEAD', 'MANAGER', 'EXECUTIVE', 'EMPLOYEE', 'READ_ONLY', 'GUEST'];
  const dbByRole = new Map<string, Set<string>>();
  roleRows.forEach((r) => {
    const s = dbByRole.get(r.role) ?? new Set<string>();
    s.add(r.permission.key);
    dbByRole.set(r.role, s);
  });
  const allowedByRole: Record<string, string[]> = {};
  for (const role of roles) {
    const dbSet = dbByRole.get(role);
    allowedByRole[role] = dbSet && dbSet.size ? [...dbSet] : expandRolePermissions(ROLE_DEFAULTS[role]);
  }

  return (
    <div>
      <PageHeader title="Roles & Permissions" description="Toggle exactly what each role can do. Super Admin always has full access." />
      <PermissionEditor
        permissions={permissions.map((p) => ({ key: p.key, module: p.module, description: p.description ?? p.key }))}
        roles={roles.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
        allowedByRole={allowedByRole}
      />
    </div>
  );
}
