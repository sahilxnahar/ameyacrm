import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { getSecurityPolicy } from '@/lib/auth/policy';
import { SecurityPolicyView } from '@/components/admin/security-policy-view';

export const metadata: Metadata = { title: 'Security policy' };
export const dynamic = 'force-dynamic';

export default async function AdminSecurityPage() {
  await requirePermission('admin.setting.manage');

  const [policy, users, devices, recentFailures] = await Promise.all([
    getSecurityPolicy(),
    prisma.user.findMany({
      where: { status: 'ACTIVE', deletedAt: null },
      select: { id: true, name: true, email: true, role: true, twoFactorEnabled: true, twoFactorGraceUntil: true, allowForeignAccess: true, lastCountry: true, lastLoginAt: true },
      orderBy: [{ twoFactorEnabled: 'asc' }, { name: 'asc' }],
    }),
    prisma.trustedDevice.findMany({
      where: { revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastSeenAt: 'desc' }, take: 60,
    }),
    prisma.loginHistory.findMany({
      where: { success: false, createdAt: { gte: new Date(Date.now() - 7 * 864e5) } },
      orderBy: { createdAt: 'desc' }, take: 30,
    }),
  ]);

  const nameOf = new Map(users.map((u) => [u.id, u.name]));

  return (
    <div>
      <PageHeader
        title="Security policy"
        description="Who must use two-factor, which devices are trusted, and where people may sign in from."
      />
      <SecurityPolicyView
        policy={policy}
        people={users.map((u) => ({
          id: u.id, name: u.name, email: u.email, role: u.role,
          twoFactorEnabled: u.twoFactorEnabled,
          graceUntil: u.twoFactorGraceUntil?.toISOString() ?? null,
          allowForeignAccess: u.allowForeignAccess,
          lastCountry: u.lastCountry,
          lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
        }))}
        devices={devices.map((d) => ({
          id: d.id, userName: nameOf.get(d.userId) ?? '—',
          label: d.label, country: d.country, ipAddress: d.ipAddress,
          lastSeenAt: d.lastSeenAt.toISOString(),
        }))}
        failures={recentFailures.map((f) => ({
          id: f.id, username: f.username, reason: f.reason,
          country: f.country, ipAddress: f.ipAddress,
          at: f.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
