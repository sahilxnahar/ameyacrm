import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldCheck, Mail, Palette, Zap, Lock } from 'lucide-react';
import { requirePermission } from '@/lib/auth/current-user';
import { Card } from '@/components/ui/card';
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
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { href: '/admin/permissions', icon: ShieldCheck, title: 'Roles & Permissions', desc: 'Toggle what each role can do' },
          { href: '/admin/templates', icon: Mail, title: 'Email Templates', desc: 'Edit system emails' },
          { href: '/admin/branding', icon: Palette, title: 'Branding', desc: 'Name, tagline, colours' },
          { href: '/admin/automations', icon: Zap, title: 'Automations', desc: 'Rules, assignment, follow-ups' },
          { href: '/admin/security', icon: Lock, title: 'Security Policy', desc: 'Enforce 2FA & login rules' },
        ].map((c) => (
          <Link key={c.href} href={c.href}>
            <Card className="flex items-center gap-3 p-4 transition-colors hover:border-primary hover:bg-secondary/40">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><c.icon className="h-5 w-5" /></div>
              <div><p className="text-sm font-medium">{c.title}</p><p className="text-xs text-muted-foreground">{c.desc}</p></div>
            </Card>
          </Link>
        ))}
      </div>
      <AdminView
        users={users.map((u) => ({ id: u.id, name: u.name, username: u.username, email: u.email, role: u.role, status: u.status, department: u.department?.name ?? null, twoFactor: u.twoFactorEnabled }))}
        departments={departments.map((d) => ({ id: d.id, name: d.name, users: d._count.users, head: d.head?.name ?? null, active: d.isActive }))}
        deptOptions={departments.map((d) => ({ id: d.id, name: d.name }))}
      />
    </div>
  );
}
