import 'server-only';
import { prisma } from '@/lib/db/prisma';
import type { ChartsData } from '@/components/dashboard/dashboard-charts';

const STAGE_ORDER = ['NEW', 'CONTACTED', 'QUALIFIED', 'SITE_VISIT', 'NEGOTIATION', 'BOOKED', 'WON'] as const;
const STAGE_LABEL: Record<string, string> = {
  NEW: 'New', CONTACTED: 'Contacted', QUALIFIED: 'Qualified', SITE_VISIT: 'Site visit',
  NEGOTIATION: 'Negotiation', BOOKED: 'Booked', WON: 'Won',
};
const SOURCE_LABEL: Record<string, string> = {
  WEBSITE: 'Website', REFERRAL: 'Referral', WALK_IN: 'Walk-in', CAMPAIGN: 'Campaign',
  PORTAL: 'Portal', NRI_DESK: 'NRI Desk', BROKER: 'Broker', OTHER: 'Other',
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Aggregates for the dashboard graphs — pipeline, lead sources, and 6-month cash flow. */
export async function getDashboardCharts(now: Date = new Date()): Promise<ChartsData> {
  const from = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [statusRows, sourceRows, vouchers] = await Promise.all([
    prisma.lead.groupBy({ by: ['status'], where: { deletedAt: null }, _count: { _all: true } }),
    prisma.lead.groupBy({ by: ['source'], where: { deletedAt: null }, _count: { _all: true } }),
    prisma.voucher.findMany({
      where: { status: 'POSTED', voucherDate: { gte: from } },
      select: { voucherDate: true, amount: true, kind: true },
      take: 20000,
    }),
  ]);

  const statusOf = new Map(statusRows.map((r) => [r.status as string, r._count._all]));
  const pipeline = STAGE_ORDER.map((s) => ({ stage: STAGE_LABEL[s] ?? s, count: statusOf.get(s) ?? 0 }));

  const sources = sourceRows
    .map((r) => ({ name: SOURCE_LABEL[r.source as string] ?? (r.source as string), value: r._count._all }))
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value);

  // 6 monthly buckets, oldest → newest.
  const buckets: Array<{ key: string; month: string; In: number; Out: number }> = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ key: `${d.getFullYear()}-${d.getMonth()}`, month: MONTHS[d.getMonth()] ?? '', In: 0, Out: 0 });
  }
  const byKey = new Map(buckets.map((b) => [b.key, b]));
  for (const v of vouchers) {
    const key = `${v.voucherDate.getFullYear()}-${v.voucherDate.getMonth()}`;
    const b = byKey.get(key);
    if (!b) continue;
    const amt = Number(v.amount);
    if (String(v.kind).includes('RECEIVED')) b.In += amt;
    else if (String(v.kind).includes('PAID')) b.Out += amt;
  }
  const cashflow = buckets.map((b) => ({ month: b.month, In: Math.round(b.In), Out: Math.round(b.Out) }));

  return { pipeline, sources, cashflow };
}
