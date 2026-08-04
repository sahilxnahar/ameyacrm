import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { ListNotice } from '@/components/ui/list-notice';
import { listWindow, listMeta } from '@/lib/list/page-window';
import { TitleVaultView } from '@/components/legal/title-vault-view';

export const metadata: Metadata = { title: 'Title Chain Vault' };
export const dynamic = 'force-dynamic';

export default async function TitleVaultPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePermission('land.view');
  const win = listWindow(await searchParams, 300);
  const [rows, titleChainEntryTotal, projects, verified] = await Promise.all([
    prisma.titleChainEntry.findMany({ orderBy: [{ registeredOn: 'asc' }], take: win.take, include: { project: { select: { name: true } } } }).catch(() => []),
    prisma.titleChainEntry.count().catch(() => 0),
    prisma.project.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }).catch(() => []),
    prisma.titleChainEntry.count({ where: { isVerified: true } }).catch(() => 0),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title="Title chain & link document vault" description="The 30-year chain of title — mother deed, sale/gift/partition deeds, mutation extracts, EC and RTC/pahani — digitised in one register, each entry verifiable, so due diligence is one screen instead of a folder of scans." />
      <TitleVaultView projects={projects} counts={{ verified, total: titleChainEntryTotal }}
        rows={rows.map((t) => ({
          id: t.id, kind: t.kind, fromParty: t.fromParty, toParty: t.toParty, documentNo: t.documentNo,
          registeredOn: t.registeredOn?.toISOString() ?? null, sroOffice: t.sroOffice,
          periodFrom: t.periodFrom, periodTo: t.periodTo, isVerified: t.isVerified,
          project: t.project?.name ?? null,
        }))} />
      <ListNotice meta={listMeta(rows.length, titleChainEntryTotal, win)} noun="chain entries" />
    </div>
  );
}
