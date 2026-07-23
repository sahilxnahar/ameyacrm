import 'server-only';
import { prisma } from '@/lib/db/prisma';

const num = (d: unknown): number => (d == null ? 0 : Number(d));

export interface CostRow {
  projectId: string;
  name: string;
  budget: number;
  committed: number; // POs raised, not necessarily paid
  spent: number;     // actual payments out
  toComplete: number; // budget − spent (0 floor)
  pctUsed: number;
}

/**
 * Per project: what was budgeted, what's been committed (POs), what's actually
 * been spent (payments out), and what's left to complete. The one view that
 * answers "is this project on track to make money?".
 */
export async function getCostToComplete(): Promise<CostRow[]> {
  const projects = await prisma.project.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  const rows: CostRow[] = [];
  for (const p of projects) {
    // Budget: the approved budget's lines (fall back to the newest budget).
    const budget = await prisma.budget.findFirst({
      where: { projectId: p.id },
      orderBy: [{ status: 'asc' }, { version: 'desc' }],
      select: { lines: { select: { amount: true } } },
    });
    const budgetTotal = (budget?.lines ?? []).reduce((s, l) => s + num(l.amount), 0);

    const [committed, spent] = await Promise.all([
      prisma.purchaseOrder.aggregate({
        where: { projectId: p.id, status: { notIn: ['DRAFT', 'CANCELLED'] } },
        _sum: { total: true },
      }),
      prisma.voucher.aggregate({
        where: { projectId: p.id, kind: { in: ['CASH_PAID', 'BANK_PAID'] }, cancelledAt: null },
        _sum: { amount: true },
      }),
    ]);

    const spentTotal = num(spent._sum.amount);
    const committedTotal = num(committed._sum.total);
    rows.push({
      projectId: p.id,
      name: p.name,
      budget: budgetTotal,
      committed: committedTotal,
      spent: spentTotal,
      toComplete: Math.max(0, budgetTotal - spentTotal),
      pctUsed: budgetTotal > 0 ? Math.round((spentTotal / budgetTotal) * 100) : 0,
    });
  }
  return rows;
}
