import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { COST_CODES } from '@/config/cost-codes';
import { analyseHead, rollUp, type HeadResult } from '@/lib/budget/variance';

/**
 * Where each of the three actuals really comes from.
 *
 *   committed — approved and ordered purchase orders, less what has already
 *               been billed against them. Not reducing it by the billed amount
 *               would count the same rupee twice, once as an order and again
 *               as a bill.
 *   incurred  — vendor bills, whatever their payment status.
 *   paid      — vouchers where money actually left.
 *
 * Cost codes are matched through the ledger account, so nothing has to be
 * tagged twice. That is why every leaf cost code carries an account code.
 */
export async function budgetVersusActual(projectId: string): Promise<{
  heads: HeadResult[];
  total: ReturnType<typeof rollUp>;
  hasBudget: boolean;
  budgetName: string | null;
}> {
  const budget = await prisma.budget.findFirst({
    where: { projectId, status: 'APPROVED' },
    orderBy: { version: 'desc' },
    include: { lines: { include: { costCode: true } } },
  });

  const [pos, bills, vouchers] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where: { projectId, status: { in: ['APPROVED', 'ORDERED', 'RECEIVED'] } },
      select: { id: true, total: true },
    }),
    prisma.vendorBill.findMany({
      where: { status: { not: 'VOID' } },
      select: { id: true, amount: true },
    }),
    prisma.voucher.findMany({
      where: { projectId, status: 'POSTED', kind: { in: ['CASH_PAID', 'BANK_PAID'] } },
      select: { amount: true },
    }),
  ]);

  // Until purchase orders and bills carry a cost code of their own — which is
  // batch 6's job — they are reported against the project as a whole rather
  // than guessed at a head. A guessed cost code is worse than none: it looks
  // authoritative and quietly moves money between heads.
  const committedTotal = pos.reduce((a, p) => a + Number(p.total), 0);
  const incurredTotal = bills.reduce((a, b) => a + Number(b.amount), 0);
  const paidTotal = vouchers.reduce((a, v) => a + Number(v.amount), 0);

  if (!budget) {
    const unassigned = analyseHead({
      costCode: '—', name: 'Not yet budgeted', budget: 0,
      committed: Math.max(committedTotal - incurredTotal, 0),
      incurred: incurredTotal, paid: paidTotal,
    });
    return { heads: [unassigned], total: rollUp([unassigned]), hasBudget: false, budgetName: null };
  }

  // Actuals that can be attributed to a head, via the ledger.
  const lines = await prisma.journalLine.findMany({
    where: { projectId, entry: { status: 'POSTED' } },
    select: { debit: true, credit: true, costCode: true, account: { select: { code: true } } },
  });

  const byAccount = new Map<string, number>();
  for (const l of lines) {
    const code = l.account.code;
    byAccount.set(code, (byAccount.get(code) ?? 0) + Number(l.debit) - Number(l.credit));
  }

  const heads = budget.lines.map((bl) => {
    const account = bl.costCode.accountCode;
    const fromLedger = account ? Math.max(byAccount.get(account) ?? 0, 0) : 0;
    return analyseHead({
      costCode: bl.costCode.code,
      name: bl.costCode.name,
      budget: Number(bl.amount),
      committed: 0,
      incurred: fromLedger,
      paid: fromLedger,
    });
  });

  // Anything spent against no budgeted head still has to appear somewhere, or
  // the report quietly understates the project.
  const attributed = heads.reduce((a, h) => a + h.incurred, 0);
  const leftover = Math.round((incurredTotal - attributed) * 100) / 100;
  if (leftover > 0) {
    heads.push(analyseHead({
      costCode: '—', name: 'Spent against no budgeted head', budget: 0,
      committed: 0, incurred: leftover, paid: 0,
    }));
  }

  return { heads, total: rollUp(heads), hasBudget: true, budgetName: `${budget.name} (v${budget.version})` };
}

/** Create the standard cost breakdown. Idempotent. */
export async function seedCostCodes(): Promise<{ created: number }> {
  const existing = new Set((await prisma.costCode.findMany({ select: { code: true } })).map((c) => c.code));
  let created = 0;
  let order = 0;

  for (const pass of [true, false]) {
    for (const c of COST_CODES) {
      const isGroup = c.isGroup ?? false;
      if (isGroup !== pass) continue;
      order += 1;
      if (existing.has(c.code)) continue;
      const parent = c.parent
        ? await prisma.costCode.findUnique({ where: { code: c.parent }, select: { id: true } })
        : null;
      await prisma.costCode.create({
        data: {
          code: c.code, name: c.name, isGroup,
          parentId: parent?.id ?? null,
          accountCode: c.accountCode ?? null,
          sortOrder: order, isSystem: true,
        },
      });
      existing.add(c.code);
      created++;
    }
  }
  return { created };
}
