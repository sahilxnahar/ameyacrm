import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { NOT_CANCELLED_OR_PENDING } from '@/lib/ledger/spent';

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
  if (!projects.length) return [];
  const ids = projects.map((p) => p.id);

  /*
   * This used to loop over the projects and make three round-trips each — the
   * budget lookup in series, then the two aggregates in parallel. Twenty active
   * projects meant forty-one queries, twenty of them strictly sequential, and
   * the report is the one that answers "is this project going to make money?",
   * so it is opened often.
   *
   * The same answer comes from four queries that do not depend on how many
   * projects there are. Grouping in Postgres rather than looping in Node is not
   * a micro-optimisation here: it turns a cost that grows with the portfolio
   * into one that does not.
   */
  const [budgets, budgetLines, committed, spent] = await Promise.all([
    prisma.budget.findMany({
      where: { projectId: { in: ids } },
      orderBy: { version: 'desc' },
      select: { id: true, projectId: true, status: true },
    }),
    prisma.budgetLine.findMany({
      where: { budget: { projectId: { in: ids } } },
      select: { budgetId: true, amount: true },
    }),
    prisma.purchaseOrder.groupBy({
      by: ['projectId'],
      where: { projectId: { in: ids }, status: { notIn: ['DRAFT', 'CANCELLED'] } },
      _sum: { total: true },
    }),
    prisma.voucher.groupBy({
      by: ['projectId'],
      where: { projectId: { in: ids }, kind: { in: ['CASH_PAID', 'BANK_PAID'] }, ...NOT_CANCELLED_OR_PENDING },
      _sum: { amount: true },
    }),
  ]);

  /*
   * Which budget counts: the approved one, falling back to the newest.
   *
   * This used to be `orderBy: [{ status: 'asc' }, { version: 'desc' }]` with a
   * comment saying it read "the approved budget". It did not. Postgres orders an
   * enum by its DECLARATION order, not alphabetically, and BudgetStatus is
   * declared DRAFT, APPROVED, SUPERSEDED — so `status: 'asc'` put DRAFT first
   * and the report has been reading the newest UNAPPROVED draft all along. On a
   * screen whose whole job is "is this project going to make money?", that is a
   * figure nobody signed off being presented as the budget.
   *
   * Found by a test that asserted the documented behaviour rather than the
   * observed one. Picking in code is also clearer than depending on the order
   * enum members happen to be written in.
   */
  const budgetForProject = new Map<string, { id: string; approved: boolean }>();
  for (const b of budgets) {
    const approved = b.status === 'APPROVED';
    const held = budgetForProject.get(b.projectId);
    // `version: desc`, so the first seen is the newest. Only an approved budget
    // may displace one already chosen, and only if that one is not approved.
    if (!held) budgetForProject.set(b.projectId, { id: b.id, approved });
    else if (approved && !held.approved) budgetForProject.set(b.projectId, { id: b.id, approved });
  }

  const linesByBudget = new Map<string, number>();
  for (const l of budgetLines) {
    linesByBudget.set(l.budgetId, (linesByBudget.get(l.budgetId) ?? 0) + num(l.amount));
  }

  const sumBy = <T extends { projectId: string | null }>(rows: T[], pick: (r: T) => unknown) => {
    const m = new Map<string, number>();
    for (const r of rows) if (r.projectId) m.set(r.projectId, num(pick(r)));
    return m;
  };
  const committedBy = sumBy(committed, (r) => r._sum.total);
  const spentBy = sumBy(spent, (r) => r._sum.amount);

  return projects.map((p) => {
    const chosen = budgetForProject.get(p.id);
    const budgetTotal = chosen ? (linesByBudget.get(chosen.id) ?? 0) : 0;
    const spentTotal = spentBy.get(p.id) ?? 0;
    const committedTotal = committedBy.get(p.id) ?? 0;
    return {
      projectId: p.id,
      name: p.name,
      budget: budgetTotal,
      committed: committedTotal,
      spent: spentTotal,
      toComplete: Math.max(0, budgetTotal - spentTotal),
      pctUsed: budgetTotal > 0 ? Math.round((spentTotal / budgetTotal) * 100) : 0,
    };
  });
}
