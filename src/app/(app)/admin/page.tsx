import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { AdminView } from '@/components/admin/admin-view';

export const metadata: Metadata = { title: 'Admin' };

export default async function AdminPage() {
  await requirePermission('admin.user.view');
  const [users, departments] = await Promise.all([
    prisma.user.findMany({
      where: { deletedAt: null }, orderBy: { createdAt: 'desc' },
      include: { department: { select: { name: true } } },
    }),
    prisma.department.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { users: true } }, head: { select: { name: true } } } }),
  ]);
  return (
    <div>
      <PageHeader title="Administration" description="Users, departments, roles and system configuration." />
      <AdminView
        users={users.map((u) => ({ id: u.id, name: u.name, username: u.username, email: u.email, role: u.role, status: u.status, department: u.department?.name ?? null, twoFactor: u.twoFactorEnabled }))}
        departments={departments.map((d) => ({ id: d.id, name: d.name, users: d._count.users, head: d.head?.name ?? null, active: d.isActive }))}
        deptOptions={departments.map((d) => ({ id: d.id, name: d.name }))}
      />
    </div>
  );
}
