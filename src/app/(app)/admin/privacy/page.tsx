import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { PrivacyView } from '@/components/admin/privacy-view';

export const metadata: Metadata = { title: 'Privacy & DPDP' };
export const dynamic = 'force-dynamic';

export default async function PrivacyPage() {
  await requirePermission('admin.setting.manage');
  const [requests, retention, consented, total] = await Promise.all([
    prisma.dataRequest.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
    prisma.setting.findUnique({ where: { key: 'dpdp.retentionMonths' } }),
    prisma.lead.count({ where: { deletedAt: null, consentAt: { not: null } } }),
    prisma.lead.count({ where: { deletedAt: null } }),
  ]);

  return (
    <div>
      <PageHeader
        title="Privacy & DPDP"
        description="Consent, retention and the right to see or erase personal data — the obligations that come with holding KYC and buyer records."
      />
      <PrivacyView
        retentionMonths={Number(retention?.value ?? 60)}
        consented={consented}
        totalLeads={total}
        requests={requests.map((r) => ({
          id: r.id, reference: r.reference, type: r.type, status: r.status,
          subjectName: r.subjectName, subjectEmail: r.subjectEmail,
          details: r.details, createdAt: r.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
