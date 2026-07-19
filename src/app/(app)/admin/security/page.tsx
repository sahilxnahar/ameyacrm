import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { SecurityPolicyView } from '@/components/admin/security-policy-view';

export const metadata: Metadata = { title: 'Security Policy' };

export default async function AdminSecurityPage() {
  await requirePermission('admin.setting.manage');
  const rows = await prisma.setting.findMany({ where: { key: { in: ['security.require2FA', 'security.require2FAForAdmins'] } } });
  const map = new Map(rows.map((r) => [r.key, r.value as unknown]));
  const t = (v: unknown) => v === true || v === 'true';
  return (
    <div className="max-w-2xl">
      <PageHeader title="Security policy" description="Organisation-wide login and two-factor rules." />
      <SecurityPolicyView require2FA={t(map.get('security.require2FA'))} require2FAForAdmins={t(map.get('security.require2FAForAdmins'))} />
    </div>
  );
}
