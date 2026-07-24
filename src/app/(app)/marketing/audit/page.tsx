import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { getCompanyDetails } from '@/server/services/company-service';
import { AuditStudio } from '@/components/marketing/audit-studio';

export const metadata: Metadata = { title: 'Website audit' };
export const dynamic = 'force-dynamic';

export default async function MarketingAuditPage() {
  await requirePermission('marketing.view');
  const [company, recent] = await Promise.all([
    getCompanyDetails(),
    prisma.marketingAudit.findMany({
      orderBy: { createdAt: 'desc' }, take: 12,
      select: { id: true, kind: true, url: true, hostname: true, score: true, summary: true, error: true, createdAt: true },
    }).catch(() => []),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Website audit"
        description="Read a page and say what would actually make it sell better. Ours, or a competitor's."
      />
      <AuditStudio
        defaultUrl={company.website || 'https://www.ameyaheights.com'}
        recent={recent.map((r) => ({
          id: r.id, kind: r.kind, url: r.url, hostname: r.hostname,
          score: r.score, summary: r.summary, error: r.error,
          when: r.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
