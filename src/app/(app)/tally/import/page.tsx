import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { TallyImportView } from '@/components/tally/tally-import-view';

export const metadata: Metadata = { title: 'Import from Tally' };
export const dynamic = 'force-dynamic';

export default async function TallyImportPage() {
  await requirePermission('admin.setting.manage');

  const rows = await prisma.tallyCompany.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, _count: { select: { ledgers: true, vouchers: true } } },
  }).catch(() => []);

  const companies = rows.map((c) => ({
    id: c.id, name: c.name, ledgers: c._count.ledgers, vouchers: c._count.vouchers,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Import from Tally"
        description="Bring your existing books across from Tally Prime or Tally.ERP 9. Every Tally company becomes its own set of books here, and re-importing the same period is safe — duplicates are skipped."
      />
      <TallyImportView companies={companies} />
    </div>
  );
}
