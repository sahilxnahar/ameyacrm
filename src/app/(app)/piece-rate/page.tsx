import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { ListNotice } from '@/components/ui/list-notice';
import { listWindow, listMeta } from '@/lib/list/page-window';
import { PieceRateView } from '@/components/legal/piece-rate-view';

export const metadata: Metadata = { title: 'Piece-Rate Billing' };
export const dynamic = 'force-dynamic';

export default async function PieceRatePage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePermission('procurement.view');
  const win = listWindow(await searchParams, 200);
  const [rows, pieceRateEntryTotal, projects, vendors, agg] = await Promise.all([
    prisma.pieceRateEntry.findMany({ orderBy: { measuredOn: 'desc' }, take: win.take, include: { project: { select: { name: true } } } }).catch(() => []),
    prisma.pieceRateEntry.count().catch(() => 0),
    prisma.project.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }).catch(() => []),
    prisma.vendor.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }).catch(() => []),
    prisma.pieceRateEntry.aggregate({ where: { voucherId: null }, _sum: { amount: true } }).catch(() => ({ _sum: { amount: null } })),
  ]);
  const vmap = new Map(vendors.map((v) => [v.id, v.name]));
  return (
    <div className="space-y-6">
      <PageHeader title="Piece-rate labour billing" description="Bill specialised sub-contractors on measured output — square feet plastered, tiled, waterproofed — not fixed attendance. Enter quantity × rate; settling raises the payment voucher on the money spine automatically." />
      <PieceRateView projects={projects} vendors={vendors}
        counts={{ unsettled: Number(agg._sum.amount ?? 0), total: pieceRateEntryTotal }}
        rows={rows.map((e) => ({ id: e.id, workItem: e.workItem, unit: e.unit, quantity: Number(e.quantity), ratePerUnit: Number(e.ratePerUnit), amount: Number(e.amount), project: e.project?.name ?? '—', vendor: e.vendorId ? (vmap.get(e.vendorId) ?? '—') : '—', settled: !!e.voucherId, measuredOn: e.measuredOn.toISOString() }))} />
      <ListNotice meta={listMeta(rows.length, pieceRateEntryTotal, win)} noun="piece-rate entries" />
    </div>
  );
}
