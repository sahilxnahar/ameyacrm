import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { AdminView } from '@/components/admin/admin-view';
import { AdminConsole } from '@/components/admin/admin-console';
import { PendingInvites } from '@/components/admin/pending-invites';

export const metadata: Metadata = { title: 'Admin' };

export default async function AdminPage() {
  const ctx = await requirePermission('admin.user.view');
  const [users, departments] = await Promise.all([
    prisma.user.findMany({
      where: { deletedAt: null }, orderBy: { createdAt: 'desc' },
      include: { department: { select: { name: true } } },
    }),
    prisma.department.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { users: true } }, head: { select: { name: true } } } }),
  ]);

  // Anyone invited who has still not signed in. Shown first because it is the
  // one thing on this page that needs chasing rather than configuring.
  const invites = await prisma.userOnboarding
    .findMany({
      where: { completedAt: null },
      orderBy: { createdAt: 'asc' },
      take: 50,
      select: { userId: true, createdAt: true, remindCount: true, welcomeSentAt: true, lastError: true, tokenExpires: true },
    })
    .catch(() => []);
  const inviteUsers = invites.length
    ? await prisma.user.findMany({
        where: { id: { in: invites.map((i) => i.userId) }, deletedAt: null, lastLoginAt: null },
        select: { id: true, name: true, email: true, username: true },
      })
    : [];
  const byId = new Map(inviteUsers.map((u) => [u.id, u]));
  const pendingInvites = invites
    .filter((i) => byId.has(i.userId))
    .map((i) => ({
      userId: i.userId,
      name: byId.get(i.userId)!.name,
      email: byId.get(i.userId)!.email,
      username: byId.get(i.userId)!.username,
      invitedAt: i.createdAt.toISOString(),
      reminders: i.remindCount,
      welcomeSent: Boolean(i.welcomeSentAt),
      linkExpired: i.tokenExpires < new Date(),
      lastError: i.lastError,
    }));
  return (
    <div>
      <PageHeader title="Administration" description="Everything that configures the CRM, in one place. Search rather than hunt." />
      <PendingInvites invites={pendingInvites} />
      <AdminConsole allowed={ctx.permissions.isSuperAdmin ? ['*'] : [...ctx.permissions.keys]} />
      <AdminView
        users={users.map((u) => ({ id: u.id, name: u.name, username: u.username, email: u.email, role: u.role, status: u.status, department: u.department?.name ?? null, twoFactor: u.twoFactorEnabled, managerId: u.managerId ?? null }))}
        departments={departments.map((d) => ({ id: d.id, name: d.name, users: d._count.users, head: d.head?.name ?? null, active: d.isActive }))}
        deptOptions={departments.map((d) => ({ id: d.id, name: d.name }))}
      />
    </div>
  );
}
