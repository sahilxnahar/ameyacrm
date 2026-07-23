import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { MARKETING_COLLATERALS } from '@/config/marketing-collaterals';
import { MarketingLibrary } from '@/components/marketing/marketing-library';
import type { LibraryItem } from '@/lib/marketing/library';

export const metadata: Metadata = { title: 'Marketing Library' };
export const dynamic = 'force-dynamic';

export default async function MarketingLibraryPage() {
  const ctx = await requirePermission('marketing.view');
  const canManage = can(ctx.permissions, 'marketing.manage') || can(ctx.permissions, 'document.create');

  const rows = await prisma.marketingLibraryItem.findMany({ orderBy: { createdAt: 'desc' }, take: 1000 }).catch(() => []);
  const items: LibraryItem[] = rows.map((r) => ({
    id: r.id, title: r.title, category: r.category, kind: r.kind, url: r.url,
    source: r.source, fileType: r.fileType, sizeBytes: r.sizeBytes, folderPath: r.folderPath, createdAt: r.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="Marketing Library" description="Your Ameya marketing collaterals — renders, brochures, comparisons and brand assets. Upload files or a whole folder (the AI sorts them), or link a Google Drive doc." />
      <MarketingLibrary featured={MARKETING_COLLATERALS} items={items} canManage={canManage} />
    </div>
  );
}
