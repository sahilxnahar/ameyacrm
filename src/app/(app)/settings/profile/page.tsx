import type { Metadata } from 'next';
import { requireAuth } from '@/lib/auth/current-user';
import { ROLE_LABELS } from '@/lib/rbac/roles';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { ProfileEditor, type ProfileInit } from '@/components/settings/profile-editor';
import { formatDate } from '@/lib/utils/format';

export const metadata: Metadata = { title: 'Profile' };
export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const { user } = await requireAuth();
  const dept = user.departmentId ? await prisma.department.findUnique({ where: { id: user.departmentId }, select: { name: true } }) : null;
  const init: ProfileInit = {
    name: user.name,
    email: user.email,
    username: user.username,
    phone: user.phone ?? null,
    whatsappNumber: user.whatsappNumber ?? null,
    designation: user.designation ?? null,
    avatarUrl: user.avatarUrl ?? null,
    employeeId: user.employeeId ?? null,
    department: dept?.name ?? null,
    roleLabel: ROLE_LABELS[user.role],
    joined: formatDate(user.joiningDate),
  };
  return (
    <div>
      <PageHeader title="Profile" description="Your details, photo and how people reach you. This is what shows across the CRM." />
      <ProfileEditor init={init} />
    </div>
  );
}
