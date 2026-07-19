import type { Metadata } from 'next';
import { requireAuth } from '@/lib/auth/current-user';
import { ROLE_LABELS } from '@/lib/rbac/roles';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { initials, formatDate } from '@/lib/utils/format';

export const metadata: Metadata = { title: 'Profile' };

export default async function ProfilePage() {
  const { user } = await requireAuth();
  const dept = user.departmentId ? await prisma.department.findUnique({ where: { id: user.departmentId }, select: { name: true } }) : null;
  const rows: [string, string][] = [
    ['Employee ID', user.employeeId ?? '—'], ['Username', user.username], ['Email', user.email],
    ['Phone', user.phone ?? '—'], ['Department', dept?.name ?? '—'], ['Designation', user.designation ?? '—'],
    ['Role', ROLE_LABELS[user.role]], ['Joined', formatDate(user.joiningDate)],
  ];
  return (
    <div>
      <PageHeader title="Profile" />
      <Card className="max-w-2xl">
        <CardHeader className="flex-row items-center gap-4">
          <Avatar className="h-16 w-16"><AvatarFallback className="text-lg">{initials(user.name)}</AvatarFallback></Avatar>
          <div><CardTitle>{user.name}</CardTitle><p className="text-sm text-muted-foreground">{user.designation ?? ROLE_LABELS[user.role]}</p></div>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            {rows.map(([k, v]) => (<div key={k}><dt className="text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd></div>))}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
