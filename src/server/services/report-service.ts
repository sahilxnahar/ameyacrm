import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { aggregate, type Metric, type AggResult } from '@/lib/reports/aggregate';
import { sourceByKey } from '@/config/report-sources';

const num = (d: unknown): number => (d == null ? 0 : Number(d));

/**
 * Fetch a whitelisted source, coerced to plain rows (Decimals → numbers) so the
 * pure aggregator can run and nothing Decimal crosses the client boundary.
 * Only the fields the source declares are read; there is no dynamic query.
 */
async function fetchSource(sourceKey: string): Promise<Array<Record<string, unknown>>> {
  switch (sourceKey) {
    case 'leads': {
      const r = await prisma.lead.findMany({ where: { deletedAt: null }, select: { status: true, source: true, temperature: true, score: true }, take: 20000 });
      return r.map((x) => ({ status: x.status, source: x.source, temperature: x.temperature, score: x.score }));
    }
    case 'bookings': {
      const r = await prisma.booking.findMany({ select: { status: true, paymentStatus: true, agreementValue: true }, take: 20000 });
      return r.map((x) => ({ status: x.status, paymentStatus: x.paymentStatus, agreementValue: num(x.agreementValue) }));
    }
    case 'tasks': {
      const r = await prisma.task.findMany({ where: { deletedAt: null }, select: { status: true, priority: true }, take: 20000 });
      return r.map((x) => ({ status: x.status, priority: x.priority }));
    }
    case 'vouchers': {
      const r = await prisma.voucher.findMany({ select: { kind: true, status: true, amount: true }, take: 20000 });
      return r.map((x) => ({ kind: x.kind, status: x.status, amount: num(x.amount) }));
    }
    case 'expenses': {
      const r = await prisma.expenseClaim.findMany({ select: { status: true, category: true, amount: true }, take: 20000 });
      return r.map((x) => ({ status: x.status, category: x.category, amount: num(x.amount) }));
    }
    default:
      return [];
  }
}

export interface BuildReportInput {
  source: string;
  groupBy: string;
  metric: Metric;
  valueKey?: string;
}

/**
 * Run a report: validate the pick against the whitelist, fetch, aggregate.
 * Returns null-safe defaults if the pick is not allowed, so a stale saved
 * report can never reach into a field it was not granted.
 */
export async function buildReport(input: BuildReportInput): Promise<AggResult & { ok: boolean; reason?: string }> {
  const src = sourceByKey(input.source);
  if (!src) return { ok: false, reason: 'Unknown source.', rows: [], total: 0, metric: input.metric };
  if (!src.groupBy.some((f) => f.key === input.groupBy)) return { ok: false, reason: 'That grouping is not available for this source.', rows: [], total: 0, metric: input.metric };
  const needsValue = input.metric === 'sum' || input.metric === 'avg';
  const valueKey = needsValue ? input.valueKey : undefined;
  if (needsValue && (!valueKey || !src.values.some((f) => f.key === valueKey))) {
    return { ok: false, reason: 'Pick a numeric field to measure.', rows: [], total: 0, metric: input.metric };
  }
  const rows = await fetchSource(input.source);
  const result = aggregate(rows, input.groupBy, input.metric, valueKey);
  return { ok: true, ...result };
}

export interface SavedReportRow {
  id: string;
  name: string;
  source: string;
  groupBy: string;
  metric: string;
  valueKey: string | null;
  shared: boolean;
  mine: boolean;
}

export async function listSavedReports(userId: string): Promise<SavedReportRow[]> {
  const rows = await prisma.savedReport.findMany({
    where: { OR: [{ ownerId: userId }, { shared: true }] },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return rows.map((r) => ({ id: r.id, name: r.name, source: r.source, groupBy: r.groupBy, metric: r.metric, valueKey: r.valueKey, shared: r.shared, mine: r.ownerId === userId }));
}

export async function getReportData() {
  const [byStatus, byPriority, deptRows, leadsByStatus] = await Promise.all([
    prisma.task.groupBy({ by: ['status'], _count: true, where: { deletedAt: null } }),
    prisma.task.groupBy({ by: ['priority'], _count: true, where: { deletedAt: null } }),
    prisma.department.findMany({ select: { name: true, _count: { select: { tasks: true } } } }),
    prisma.lead.groupBy({ by: ['status'], _count: true, where: { deletedAt: null } }),
  ]);
  return {
    tasksByStatus: byStatus.map((r) => ({ name: r.status, value: r._count })),
    tasksByPriority: byPriority.map((r) => ({ name: r.priority, value: r._count })),
    departmentWorkload: deptRows.map((d) => ({ name: d.name, tasks: d._count.tasks })).sort((a, b) => b.tasks - a.tasks).slice(0, 10),
    leadsByStatus: leadsByStatus.map((r) => ({ name: r.status, value: r._count })),
  };
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]!);
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n');
}
