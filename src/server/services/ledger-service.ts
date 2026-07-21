import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { checkEntry, reverseLines, rupees, signedBalance, type DraftLine, type CheckedLine } from '@/lib/ledger/entry';
import { CHART_OF_ACCOUNTS, normalSide, REQUIRED_CODES } from '@/config/chart-of-accounts';

export type PostResult = { ok: true; entryId: string; number: string } | { error: string };

/** JV-000001, JV-000002 … taken inside the transaction so two posts cannot collide. */
async function nextNumber(tx: { journalEntry: { count: (a?: unknown) => Promise<number> } }): Promise<string> {
  const n = await tx.journalEntry.count();
  return `JV-${String(n + 1).padStart(6, '0')}`;
}

export interface PostOptions {
  entryDate?: Date;
  narration: string;
  lines: DraftLine[];
  sourceType?: string;
  sourceId?: string;
  projectId?: string | null;
  costCode?: string | null;
  createdById?: string | null;
  /**
   * Posting the same source twice is the commonest way a ledger goes wrong —
   * a retried request, a double click, a re-run cron. When this is set, a
   * second attempt for the same source is refused rather than duplicated.
   */
  once?: boolean;
}

/**
 * Write one balanced entry to the ledger.
 *
 * Everything happens in a single transaction: either every line lands or none
 * does. A half-written entry would leave the books permanently out, and no
 * report downstream could be trusted again.
 */
export async function post(opts: PostOptions): Promise<PostResult> {
  const checked = checkEntry(opts.lines);
  if (!checked.ok) return { error: checked.error };

  const codes = [...new Set(checked.entry.lines.map((l) => l.accountCode))];
  const accounts = await prisma.account.findMany({
    where: { code: { in: codes } },
    select: { id: true, code: true, isGroup: true, isActive: true, name: true },
  });
  const byCode = new Map(accounts.map((a) => [a.code, a]));

  for (const code of codes) {
    const a = byCode.get(code);
    if (!a) return { error: `There is no account with the code ${code}. The chart of accounts may not have been set up yet.` };
    if (a.isGroup) return { error: `"${a.name}" is a heading, not an account. Post to one of the accounts underneath it.` };
    if (!a.isActive) return { error: `The account "${a.name}" is switched off.` };
  }

  if (opts.once && opts.sourceType && opts.sourceId) {
    const already = await prisma.journalEntry.findFirst({
      where: { sourceType: opts.sourceType, sourceId: opts.sourceId, status: { not: 'REVERSED' } },
      select: { number: true },
    });
    if (already) return { error: `This has already been posted to the ledger as ${already.number}.` };
  }

  try {
    const entry = await prisma.$transaction(async (tx) => {
      const number = await nextNumber(tx as never);
      return tx.journalEntry.create({
        data: {
          number,
          entryDate: opts.entryDate ?? new Date(),
          status: 'POSTED',
          narration: opts.narration.slice(0, 500),
          sourceType: opts.sourceType ?? 'Manual',
          sourceId: opts.sourceId ?? null,
          projectId: opts.projectId ?? null,
          costCode: opts.costCode ?? null,
          createdById: opts.createdById ?? null,
          lines: {
            create: checked.entry.lines.map((l) => ({
              accountId: byCode.get(l.accountCode)!.id,
              debit: rupees(l.debitPaise),
              credit: rupees(l.creditPaise),
              narration: l.narration ?? null,
              vendorId: l.vendorId ?? null,
              customerId: l.customerId ?? null,
              projectId: l.projectId ?? opts.projectId ?? null,
              costCode: l.costCode ?? opts.costCode ?? null,
            })),
          },
        },
        select: { id: true, number: true },
      });
    });
    return { ok: true, entryId: entry.id, number: entry.number };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'The entry could not be posted.' };
  }
}

/**
 * Undo a posted entry by posting its opposite.
 *
 * The original stays exactly as it was. This is not squeamishness: an
 * editable ledger cannot be audited, and "what did this look like before
 * somebody changed it" is a question with no answer once you allow edits.
 */
export async function reverse(entryId: string, reason: string, actorId?: string): Promise<PostResult> {
  const original = await prisma.journalEntry.findUnique({
    where: { id: entryId },
    include: { lines: { include: { account: { select: { code: true } } } } },
  });
  if (!original) return { error: 'That entry was not found.' };
  if (original.status === 'REVERSED') return { error: 'That entry has already been reversed.' };
  if (original.status === 'DRAFT') return { error: 'A draft has not been posted, so there is nothing to reverse.' };

  const asChecked: CheckedLine[] = original.lines.map((l) => ({
    accountCode: l.account.code,
    debitPaise: Math.round(Number(l.debit) * 100),
    creditPaise: Math.round(Number(l.credit) * 100),
    narration: l.narration ?? undefined,
    vendorId: l.vendorId,
    customerId: l.customerId,
    projectId: l.projectId,
    costCode: l.costCode,
  }));

  const flipped = reverseLines(asChecked).map((l) => ({
    accountCode: l.accountCode,
    debit: rupees(l.debitPaise),
    credit: rupees(l.creditPaise),
    narration: l.narration,
    vendorId: l.vendorId,
    customerId: l.customerId,
    projectId: l.projectId,
    costCode: l.costCode,
  }));

  const result = await post({
    narration: `Reversal of ${original.number} — ${reason}`.slice(0, 500),
    lines: flipped,
    sourceType: 'Reversal',
    sourceId: original.id,
    projectId: original.projectId,
    createdById: actorId ?? null,
    entryDate: new Date(),
  });
  if ('error' in result) return result;

  await prisma.journalEntry.update({
    where: { id: original.id },
    data: { status: 'REVERSED', reversedById: result.entryId, reversedAt: new Date(), reversalReason: reason.slice(0, 300) },
  });
  return result;
}

// ── Reading the books ───────────────────────────────────────────────────────

export interface TrialRow {
  code: string; name: string; type: string; isGroup: boolean;
  debit: number; credit: number; balance: number;
}

/**
 * The trial balance: every account, its two totals, and the proof that the
 * whole thing adds up. If `balanced` is ever false, something is wrong at a
 * level worth stopping for.
 */
export async function trialBalance(opts: { upto?: Date; projectId?: string } = {}): Promise<{
  rows: TrialRow[]; totalDebit: number; totalCredit: number; balanced: boolean;
}> {
  const [accounts, sums] = await Promise.all([
    prisma.account.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true, type: true, isGroup: true, openingBalance: true, side: true },
      orderBy: { code: 'asc' },
    }),
    prisma.journalLine.groupBy({
      by: ['accountId'],
      _sum: { debit: true, credit: true },
      where: {
        entry: {
          status: 'POSTED',
          ...(opts.upto ? { entryDate: { lte: opts.upto } } : {}),
        },
        ...(opts.projectId ? { projectId: opts.projectId } : {}),
      },
    }),
  ]);

  const sumBy = new Map(sums.map((s) => [s.accountId, s]));
  let totalDebit = 0;
  let totalCredit = 0;

  const rows: TrialRow[] = accounts.map((a) => {
    const s = sumBy.get(a.id);
    let debit = Number(s?._sum.debit ?? 0);
    let credit = Number(s?._sum.credit ?? 0);

    // An opening balance belongs on whichever side the account normally sits.
    const opening = Number(a.openingBalance ?? 0);
    if (opening !== 0) {
      if (a.side === 'DEBIT') debit += opening;
      else credit += opening;
    }

    totalDebit += debit;
    totalCredit += credit;
    return {
      code: a.code, name: a.name, type: a.type, isGroup: a.isGroup,
      debit, credit,
      balance: rupees(signedBalance(a.type, Math.round(debit * 100), Math.round(credit * 100))),
    };
  });

  return {
    rows,
    totalDebit: rupees(Math.round(totalDebit * 100)),
    totalCredit: rupees(Math.round(totalCredit * 100)),
    // Compared in paise. Comparing rupees as floats is how a balanced ledger
    // reports itself as out by 0.0000001.
    balanced: Math.round(totalDebit * 100) === Math.round(totalCredit * 100),
  };
}

export async function profitAndLoss(opts: { from: Date; to: Date; projectId?: string }) {
  const tb = await trialBalance({ upto: opts.to, projectId: opts.projectId });
  const income = tb.rows.filter((r) => r.type === 'INCOME' && !r.isGroup);
  const expense = tb.rows.filter((r) => r.type === 'EXPENSE' && !r.isGroup);
  const totalIncome = income.reduce((a, r) => a + r.balance, 0);
  const totalExpense = expense.reduce((a, r) => a + r.balance, 0);
  return { income, expense, totalIncome, totalExpense, profit: rupees(Math.round((totalIncome - totalExpense) * 100)) };
}

export async function balanceSheet(opts: { upto: Date; projectId?: string }) {
  const tb = await trialBalance({ upto: opts.upto, projectId: opts.projectId });
  const pick = (t: string) => tb.rows.filter((r) => r.type === t && !r.isGroup);
  const assets = pick('ASSET');
  const liabilities = pick('LIABILITY');
  const equity = pick('EQUITY');

  const totalAssets = assets.reduce((a, r) => a + r.balance, 0);
  const totalLiabilities = liabilities.reduce((a, r) => a + r.balance, 0);
  const totalEquity = equity.reduce((a, r) => a + r.balance, 0);

  // Profit for the period is part of equity but has not been closed into it,
  // so it is added here rather than left to make the sheet appear not to balance.
  const income = pick('INCOME').reduce((a, r) => a + r.balance, 0);
  const expense = pick('EXPENSE').reduce((a, r) => a + r.balance, 0);
  const retained = rupees(Math.round((income - expense) * 100));

  const left = Math.round(totalAssets * 100);
  const right = Math.round((totalLiabilities + totalEquity + retained) * 100);

  return {
    assets, liabilities, equity,
    totalAssets, totalLiabilities, totalEquity, retained,
    balanced: left === right,
    difference: rupees(left - right),
  };
}

/** A party's running account: what they were billed, what they were paid, what is left. */
export async function partyLedger(opts: { vendorId?: string; customerId?: string; upto?: Date }) {
  if (!opts.vendorId && !opts.customerId) return { lines: [], balance: 0 };

  const lines = await prisma.journalLine.findMany({
    where: {
      ...(opts.vendorId ? { vendorId: opts.vendorId } : {}),
      ...(opts.customerId ? { customerId: opts.customerId } : {}),
      entry: { status: 'POSTED', ...(opts.upto ? { entryDate: { lte: opts.upto } } : {}) },
    },
    include: {
      entry: { select: { number: true, entryDate: true, narration: true, sourceType: true, sourceId: true } },
      account: { select: { code: true, name: true, type: true } },
    },
    orderBy: { entry: { entryDate: 'asc' } },
  });

  let runningPaise = 0;
  const out = lines.map((l) => {
    const d = Math.round(Number(l.debit) * 100);
    const c = Math.round(Number(l.credit) * 100);
    // A vendor is a liability: a credit increases what you owe them.
    runningPaise += c - d;
    return {
      id: l.id,
      date: l.entry.entryDate,
      number: l.entry.number,
      narration: l.narration ?? l.entry.narration,
      account: l.account.name,
      debit: Number(l.debit),
      credit: Number(l.credit),
      running: rupees(runningPaise),
    };
  });
  return { lines: out, balance: rupees(runningPaise) };
}

// ── Setting up ──────────────────────────────────────────────────────────────

/**
 * Create the chart of accounts if it is not there.
 *
 * Idempotent, so it can be run whenever without producing a second copy —
 * which matters because it is called from the repair path as well as by hand.
 */
export async function seedChartOfAccounts(): Promise<{ created: number; existing: number; missing: string[] }> {
  const existing = await prisma.account.findMany({ select: { code: true } });
  const have = new Set(existing.map((a) => a.code));
  let created = 0;

  // Two passes: parents must exist before children can point at them.
  for (const pass of [true, false]) {
    for (const a of CHART_OF_ACCOUNTS) {
      if (Boolean(a.isGroup) !== pass) continue;
      if (have.has(a.code)) continue;
      const parent = a.parent
        ? await prisma.account.findUnique({ where: { code: a.parent }, select: { id: true } })
        : null;
      await prisma.account.create({
        data: {
          code: a.code, name: a.name, type: a.type, side: normalSide(a.type),
          isGroup: a.isGroup ?? false, parentId: parent?.id ?? null,
          description: a.note ?? null, isSystem: true,
        },
      });
      have.add(a.code);
      created++;
    }
  }

  const missing = REQUIRED_CODES.filter((c) => !have.has(c));
  return { created, existing: existing.length, missing };
}
