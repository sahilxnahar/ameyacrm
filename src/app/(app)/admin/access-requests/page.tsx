import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { AccessRequestsView } from '@/components/admin/access-requests-view';
import { getSignupConfig } from '@/server/actions/signup';

export const metadata: Metadata = { title: 'Access requests' };
export const dynamic = 'force-dynamic';

export default async function AccessRequestsPage() {
  await requirePermission('admin.user.manage');
  const [pending, cfg, recent] = await Promise.all([
    prisma.user.findMany({
      where: { status: 'PENDING', deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, email: true, signupNote: true, emailVerifiedAt: true, createdAt: true, role: true },
    }),
    getSignupConfig(),
    prisma.user.findMany({
      where: { approvedAt: { not: null }, deletedAt: null },
      orderBy: { approvedAt: 'desc' },
      take: 20,
      select: { id: true, name: true, email: true, role: true, approvedAt: true },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Access requests"
        description="People who have asked to join the CRM. Anyone on an approved domain activates themselves; everyone else waits here."
      />
      <AccessRequestsView
        requests={pending.map((u) => ({
          id: u.id, name: u.name, email: u.email, note: u.signupNote,
          verified: Boolean(u.emailVerifiedAt),
          requestedAt: u.createdAt.toISOString(),
          role: u.role,
        }))}
        recent={recent.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, approvedAt: u.approvedAt!.toISOString() }))}
        config={{ domains: cfg.domains.join(', '), defaultRole: cfg.defaultRole, enabled: cfg.enabled }}
      />
    </div>
  );
}
