import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { SocialAccountsView } from '@/components/social/social-accounts-view';

export const metadata: Metadata = { title: 'Social accounts' };
export const dynamic = 'force-dynamic';

export default async function SocialAccountsPage() {
  const ctx = await requirePermission('dashboard.view');
  const isAdmin = can(ctx.permissions, 'admin.user.manage');

  const users = await prisma.user.findMany({
    where: { status: 'ACTIVE', deletedAt: null, ...(isAdmin ? {} : { id: ctx.user.id }) },
    select: {
      id: true, name: true, email: true, whatsappNumber: true, designation: true,
      department: { select: { name: true } },
      socialAccounts: { orderBy: { createdAt: 'asc' } },
    },
    orderBy: { name: 'asc' },
  });

  return (
    <div>
      <PageHeader
        title="Social accounts"
        description="Which handle belongs to whom, and the WhatsApp number each person messages leads from."
      />
      <SocialAccountsView
        meId={ctx.user.id}
        isAdmin={isAdmin}
        people={users.map((u) => ({
          id: u.id, name: u.name, email: u.email,
          designation: u.designation,
          departmentName: u.department?.name ?? null,
          whatsappNumber: u.whatsappNumber,
          accounts: u.socialAccounts.map((a) => ({
            id: a.id, channel: a.channel, handle: a.handle,
            profileUrl: a.profileUrl, displayName: a.displayName, isActive: a.isActive, notes: a.notes,
          })),
        }))}
      />
    </div>
  );
}
