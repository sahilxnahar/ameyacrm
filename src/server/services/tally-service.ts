import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { DEFAULT_LEDGERS, natureOfGroup, type Nature } from '@/config/tally-groups';

export interface TallyLedgerRow {
  id: string; name: string; group: string; nature: Nature;
  balance: number; side: 'Dr' | 'Cr'; isSystem: boolean;
}
export interface TallyVoucherRow {
  id: string; number: number; type: string; date: string; narration: string | null;
  amount: number; lines: Array<{ ledger: string; debit: number; credit: number }>;
}
export interface TrialRow { name: string; group: string; debit: number; credit: number }
export interface TallyData {
  ledgers: TallyLedgerRow[];
  vouchers: TallyVoucherRow[];
  trial: { rows: TrialRow[]; totalDebit: number; totalCredit: number; balanced: boolean };
  totals: { ledgers: number; vouchers: number };
}

const n = (d: unknown) => (d == null ? 0 : Number(d));

/** Create Cash and Profit & Loss A/c the first time, like a fresh Tally company. */
export async function ensureDefaultLedgers(): Promise<void> {
  const count = await prisma.tallyLedger.count();
  if (count > 0) return;
  for (const d of DEFAULT_LEDGERS) {
    await prisma.tallyLedger.create({ data: { name: d.name, group: d.group, isSystem: d.system } }).catch(() => undefined);
  }
}

export async function getTallyData(): Promise<TallyData> {
  await ensureDefaultLedgers();
  const [ledgers, sums, vouchers] = await Promise.all([
    prisma.tallyLedger.findMany({ orderBy: { name: 'asc' } }),
    prisma.tallyVoucherLine.groupBy({ by: ['ledgerId'], _sum: { debit: true, credit: true } }),
    prisma.tallyVoucher.findMany({
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: 200,
      include: { lines: { include: { ledger: { select: { name: true } } } } },
    }),
  ]);
  const sumOf = new Map(sums.map((s) => [s.ledgerId, { d: n(s._sum.debit), c: n(s._sum.credit) }]));

  const ledgerRows: TallyLedgerRow[] = ledgers.map((l) => {
    const s = sumOf.get(l.id) ?? { d: 0, c: 0 };
    const openDr = l.openingSide === 'Dr' ? n(l.openingBalance) : 0;
    const openCr = l.openingSide === 'Cr' ? n(l.openingBalance) : 0;
    const net = Math.round((s.d + openDr - s.c - openCr) * 100) / 100;
    return {
      id: l.id, name: l.name, group: l.group, nature: natureOfGroup(l.group),
      balance: Math.abs(net), side: net >= 0 ? 'Dr' : 'Cr', isSystem: l.isSystem,
    };
  });

  // Trial balance from the same figures.
  let totalDebit = 0, totalCredit = 0;
  const trialRows: TrialRow[] = ledgerRows
    .filter((r) => r.balance !== 0)
    .map((r) => {
      const debit = r.side === 'Dr' ? r.balance : 0;
      const credit = r.side === 'Cr' ? r.balance : 0;
      totalDebit += debit; totalCredit += credit;
      return { name: r.name, group: r.group, debit, credit };
    });

  const voucherRows: TallyVoucherRow[] = vouchers.map((v) => {
    const lines = v.lines.map((ln) => ({ ledger: ln.ledger.name, debit: n(ln.debit), credit: n(ln.credit) }));
    const amount = lines.reduce((s, ln) => s + ln.debit, 0);
    return { id: v.id, number: v.number, type: v.type, date: v.date.toISOString(), narration: v.narration, amount, lines };
  });

  return {
    ledgers: ledgerRows,
    vouchers: voucherRows,
    trial: {
      rows: trialRows,
      totalDebit: Math.round(totalDebit * 100) / 100,
      totalCredit: Math.round(totalCredit * 100) / 100,
      balanced: Math.round(totalDebit * 100) === Math.round(totalCredit * 100),
    },
    totals: { ledgers: ledgers.length, vouchers: await prisma.tallyVoucher.count() },
  };
}
