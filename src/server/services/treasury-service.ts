import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { reconcile, type StatementLineInput, type VoucherCandidate, type ReconResult } from '@/lib/treasury/reconcile';
import { rollingForecast, type Flow, type Forecast } from '@/lib/treasury/forecast';

/**
 * Treasury queries, assembled server-side and handed to the client as plain
 * numbers. Everything money-shaped is a Prisma Decimal in the database and a
 * Number here — these are treasury display figures, not ledger postings, and a
 * Decimal cannot cross the server/client boundary.
 */

const num = (d: unknown): number => (d == null ? 0 : Number(d));
const numN = (d: unknown): number | null => (d == null ? null : Number(d));

export interface BankPosition {
  id: string;
  name: string;
  bankName: string;
  accountLast4: string | null;
  openingBalance: number;
  movement: number;
  position: number;
  lineCount: number;
  unmatched: number;
}

export async function bankPositions(projectId?: string | null): Promise<BankPosition[]> {
  const accounts = await prisma.bankAccount.findMany({
    where: { isActive: true, ...(projectId ? { projectId } : {}) },
    orderBy: { name: 'asc' },
    include: {
      lines: { select: { amount: true, status: true } },
    },
  });
  return accounts.map((a) => {
    const movement = a.lines.reduce((s, l) => s + num(l.amount), 0);
    return {
      id: a.id,
      name: a.name,
      bankName: a.bankName,
      accountLast4: a.accountLast4,
      openingBalance: num(a.openingBalance),
      movement,
      position: num(a.openingBalance) + movement,
      lineCount: a.lines.length,
      unmatched: a.lines.filter((l) => l.status === 'UNMATCHED').length,
    };
  });
}

const directionOf = (kind: string): 'IN' | 'OUT' | null =>
  kind.endsWith('_RECEIVED') ? 'IN' : kind.endsWith('_PAID') ? 'OUT' : null;

export interface UnmatchedLine {
  id: string;
  bankAccountId: string;
  txnDate: Date;
  description: string;
  refNo: string | null;
  amount: number;
}
export interface SuggestedMatch {
  lineId: string;
  voucherId: string;
  voucherNumber: string;
  partyName: string;
  confidence: string;
  amount: number;
}

/**
 * Build the reconciliation view for one bank account: the still-unmatched lines,
 * the posted bank vouchers that have not been tied to a line, and the machine's
 * suggested pairings — surfaced for a person to confirm, never booked silently.
 */
export async function reconciliationView(bankAccountId: string): Promise<{
  lines: UnmatchedLine[];
  suggestions: SuggestedMatch[];
  candidateCount: number;
}> {
  const lineRows = await prisma.bankStatementLine.findMany({
    where: { bankAccountId, status: 'UNMATCHED' },
    orderBy: { txnDate: 'desc' },
    take: 500,
  });

  // Exclusion is global, not per-account: a voucher already reconciled against a
  // line on any account must not be offered again here, or one payment could be
  // matched twice across two statements.
  const takenVoucherIds = new Set(
    (await prisma.bankStatementLine.findMany({
      where: { status: 'MATCHED', matchedVoucherId: { not: null } },
      select: { matchedVoucherId: true },
    })).map((l) => l.matchedVoucherId!),
  );

  const vouchers = await prisma.voucher.findMany({
    where: { status: 'POSTED', kind: { in: ['CASH_RECEIVED', 'CASH_PAID', 'BANK_RECEIVED', 'BANK_PAID'] } },
    select: { id: true, number: true, utr: true, amount: true, voucherDate: true, paidOn: true, partyName: true, kind: true },
    orderBy: { voucherDate: 'desc' },
    take: 1000,
  });

  const candidates: VoucherCandidate[] = vouchers
    .filter((v) => !takenVoucherIds.has(v.id) && directionOf(v.kind) != null)
    .map((v) => ({
      id: v.id,
      number: v.number,
      utr: v.utr,
      amount: num(v.amount),
      date: v.paidOn ?? v.voucherDate,
      partyName: v.partyName,
      direction: directionOf(v.kind)!,
    }));

  const lines: StatementLineInput[] = lineRows.map((l) => ({
    id: l.id, date: l.txnDate, amount: num(l.amount), refNo: l.refNo, description: l.description,
  }));

  const result: ReconResult = reconcile(lines, candidates);
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const suggestions: SuggestedMatch[] = result.matches.map((m) => {
    const v = byId.get(m.voucherId)!;
    return { lineId: m.lineId, voucherId: m.voucherId, voucherNumber: v.number, partyName: v.partyName, confidence: m.confidence, amount: v.amount };
  });

  return {
    lines: lineRows.map((l) => ({ id: l.id, bankAccountId: l.bankAccountId, txnDate: l.txnDate, description: l.description, refNo: l.refNo, amount: num(l.amount) })),
    suggestions,
    candidateCount: candidates.length,
  };
}

export interface LoanRow {
  id: string;
  lender: string;
  kind: string;
  sanctionedAmount: number;
  interestRate: number | null;
  drawn: number;
  repaid: number;
  interestPaid: number;
  outstanding: number;
  isActive: boolean;
}

export async function loanBook(projectId?: string | null): Promise<LoanRow[]> {
  const loans = await prisma.loanFacility.findMany({
    where: projectId ? { projectId } : undefined,
    orderBy: [{ isActive: 'desc' }, { lender: 'asc' }],
    include: { events: { select: { kind: true, amount: true } } },
  });
  return loans.map((l) => {
    let drawn = 0, repaid = 0, interestPaid = 0;
    for (const e of l.events) {
      const a = num(e.amount);
      if (e.kind === 'DRAWDOWN') drawn += a;
      else if (e.kind === 'REPAYMENT') repaid += a;
      else if (e.kind === 'INTEREST') interestPaid += a;
    }
    return {
      id: l.id, lender: l.lender, kind: l.kind,
      sanctionedAmount: num(l.sanctionedAmount), interestRate: numN(l.interestRate),
      drawn, repaid, interestPaid, outstanding: drawn - repaid, isActive: l.isActive,
    };
  });
}

/**
 * A twelve-week rolling forecast for the whole company: buyer demands and
 * outstanding invoices coming in, vendor bills going out, against the current
 * bank position.
 *
 * This is deliberately company-wide, not project-scoped. Vendor bills carry no
 * project link, so a "project forecast" would set one project's buyer demands
 * against every project's bills — a wrong number that looks precise. Until bills
 * carry a cost centre (a later batch), the honest forecast is the consolidated
 * one, and it is labelled as such.
 */
export async function cashForecast(now: Date): Promise<Forecast & { horizonNote: string }> {
  const positions = await bankPositions();
  const opening = positions.reduce((s, p) => s + p.position, 0);

  const [milestones, invoices, bills] = await Promise.all([
    prisma.paymentMilestone.findMany({
      where: { status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] }, dueDate: { not: null } },
      select: { amount: true, dueDate: true, label: true },
    }),
    prisma.invoice.findMany({
      where: { status: { in: ['SENT', 'PARTIAL', 'OVERDUE'] }, dueDate: { not: null } },
      select: { total: true, amountPaid: true, dueDate: true, number: true },
    }),
    prisma.vendorBill.findMany({
      where: { status: { in: ['SENT', 'PARTIAL', 'OVERDUE'] } },
      select: { amount: true, gstAmount: true, dueDate: true, billDate: true, number: true },
    }),
  ]);

  const flows: Flow[] = [];
  for (const m of milestones) if (m.dueDate) flows.push({ date: m.dueDate, amount: num(m.amount), label: m.label });
  for (const inv of invoices) if (inv.dueDate) flows.push({ date: inv.dueDate, amount: num(inv.total) - num(inv.amountPaid), label: inv.number });
  for (const b of bills) flows.push({ date: b.dueDate ?? b.billDate, amount: -(num(b.amount) + num(b.gstAmount)), label: b.number });

  const forecast = rollingForecast(now, opening, flows, 12);
  return {
    ...forecast,
    horizonNote: `Company-wide: ${flows.length} scheduled flow${flows.length === 1 ? '' : 's'} across ${positions.length} bank account${positions.length === 1 ? '' : 's'}.`,
  };
}
