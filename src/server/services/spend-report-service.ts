import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { projectScope } from '@/server/services/active-project-service';
import { CATEGORY_LABEL } from '@/config/expense-categories';

const num = (d: unknown): number => (d == null ? 0 : Number(d));
const PAID_KINDS = ['CASH_PAID', 'BANK_PAID'] as const;

export interface SpendSlice { key: string; label: string; total: number; count: number }
export interface SpendReport {
  total: number;
  count: number;
  byCategory: SpendSlice[];
  byVendor: SpendSlice[];
  byProject: SpendSlice[];
  byMonth: SpendSlice[];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Everything you've paid out, sliced the four ways people actually ask about:
 * by category, by payee, by project, and by month. Honours the active project
 * (untagged payments are always included, so nothing hides).
 */
export async function getSpendReport(activeProjectId: string | null): Promise<SpendReport> {
  const rows = await prisma.voucher.findMany({
    where: { kind: { in: [...PAID_KINDS] }, cancelledAt: null, ...projectScope(activeProjectId) },
    select: { amount: true, voucherDate: true, accountCode: true, partyName: true, projectId: true },
    take: 20000,
  });

  const projects = await prisma.project.findMany({ select: { id: true, name: true } });
  const projName = new Map(projects.map((p) => [p.id, p.name]));

  const cat = new Map<string, { total: number; count: number }>();
  const ven = new Map<string, { total: number; count: number }>();
  const proj = new Map<string, { total: number; count: number }>();
  const mon = new Map<string, { total: number; count: number }>();
  let total = 0;

  const bump = (m: Map<string, { total: number; count: number }>, key: string, amt: number) => {
    const cur = m.get(key) ?? { total: 0, count: 0 };
    cur.total += amt; cur.count += 1; m.set(key, cur);
  };

  for (const r of rows) {
    const amt = num(r.amount);
    total += amt;
    bump(cat, r.accountCode ?? '—', amt);
    bump(ven, (r.partyName ?? '—').trim() || '—', amt);
    bump(proj, r.projectId ?? '—', amt);
    const d = r.voucherDate;
    bump(mon, `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`, amt);
  }

  const slices = (m: Map<string, { total: number; count: number }>, label: (k: string) => string): SpendSlice[] =>
    [...m.entries()].map(([key, v]) => ({ key, label: label(key), total: v.total, count: v.count })).sort((a, b) => b.total - a.total);

  const monthLabel = (k: string) => { const [y, mo] = k.split('-'); return `${MONTHS[Number(mo) - 1] ?? mo} ${y}`; };

  return {
    total,
    count: rows.length,
    byCategory: slices(cat, (k) => (k === '—' ? 'Uncategorised' : CATEGORY_LABEL[k] ?? k)),
    byVendor: slices(ven, (k) => k).slice(0, 25),
    byProject: slices(proj, (k) => (k === '—' ? 'No project' : projName.get(k) ?? k)),
    byMonth: [...mon.entries()].map(([key, v]) => ({ key, label: monthLabel(key), total: v.total, count: v.count })).sort((a, b) => a.key.localeCompare(b.key)),
  };
}
