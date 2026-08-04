import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { ListNotice } from '@/components/ui/list-notice';
import { listWindow, listMeta } from '@/lib/list/page-window';
import { HeirMapperView } from '@/components/legal/heir-mapper-view';

export const metadata: Metadata = { title: 'JDA Heir Mapper' };
export const dynamic = 'force-dynamic';

export default async function HeirMapperPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePermission('land.view');
  const win = listWindow(await searchParams, 400);
  const [rows, landownerTotal, projects] = await Promise.all([
    prisma.landowner.findMany({ orderBy: { createdAt: 'asc' }, take: win.take, include: { project: { select: { name: true } }, parent: { select: { name: true } } } }).catch(() => []),
    prisma.landowner.count().catch(() => 0),
    prisma.project.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }).catch(() => []),
  ]);
  const relinquished = rows.filter((r) => r.relinquished).length;
  return (
    <div className="space-y-6">
      <PageHeader title="JDA succession & legal-heir mapper" description="Map the landowner genealogy behind a joint-development agreement — who inherits what undivided share, who is deceased, and who has signed a relinquishment deed — so the JDA is executed by every rightful heir and no title claim surfaces later." />
      <HeirMapperView projects={projects} counts={{ total: landownerTotal, relinquished }}
        owners={rows.map((o) => ({ id: o.id, name: o.name, relationToRoot: o.relationToRoot, parentName: o.parent?.name ?? null, isDeceased: o.isDeceased, shareNum: o.shareNum, shareDen: o.shareDen, relinquished: o.relinquished, relinquishDeedNo: o.relinquishDeedNo, project: o.project?.name ?? null }))}
        pickable={rows.map((o) => ({ id: o.id, name: o.name }))} />
      <ListNotice meta={listMeta(rows.length, landownerTotal, win)} noun="landowners" />
    </div>
  );
}
