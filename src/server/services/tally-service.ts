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
export interface StockRow {
  id: string; name: string; unit: string; gstRate: number;
  inQty: number; outQty: number; closingQty: number; rate: number; value: number;
}
export interface TallyData {
  ledgers: TallyLedgerRow[];
  vouchers: TallyVoucherRow[];
  stock: StockRow[];
  trial: { rows: TrialRow[]; totalDebit: number; totalCredit: number; balanced: boolean };
  totals: { ledgers: number; vouchers: number; stock: number };
}

const n = (d: unknown) => (d == null ? 0 : Number(d));

/** Trading & GST ledgers needed for item invoicing. Auto-created, idempotent. */
export const TRADING_LEDGERS = [
  { name: 'Sales', group: 'Sales Accounts' },
  { name: 'Purchase', group: 'Purchase Accounts' },
  { name: 'Output GST', group: 'Duties & Taxes' },
  { name: 'Input GST', group: 'Duties & Taxes' },
] as const;

/** Create Cash and Profit & Loss A/c the first time, like a fresh Tally company. */
export async function ensureDefaultLedgers(): Promise<void> {
  const count = await prisma.tallyLedger.count();
  if (count === 0) {
    for (const d of DEFAULT_LEDGERS) {
      await prisma.tallyLedger.create({ data: { name: d.name, group: d.group, isSystem: d.system } }).catch(() => undefined);
    }
  }
  // Trading/GST ledgers appear once stock items exist, so item invoices can post.
  const items = await prisma.tallyStockItem.count();
  if (items > 0) {
    for (const t of TRADING_LEDGERS) {
      const has = await prisma.tallyLedger.findUnique({ where: { name: t.name }, select: { id: true } });
      if (!has) await prisma.tallyLedger.create({ data: { name: t.name, group: t.group, isSystem: true } }).catch(() => undefined);
    }
  }
}

export async function getTallyData(): Promise<TallyData> {
  await ensureDefaultLedgers();
  const [ledgers, sums, vouchers, items, invSums] = await Promise.all([
    prisma.tallyLedger.findMany({ orderBy: { name: 'asc' } }),
    prisma.tallyVoucherLine.groupBy({ by: ['ledgerId'], _sum: { debit: true, credit: true } }),
    prisma.tallyVoucher.findMany({
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: 200,
      include: { lines: { include: { ledger: { select: { name: true } } } } },
    }),
    prisma.tallyStockItem.findMany({ orderBy: { name: 'asc' } }),
    prisma.tallyInventoryLine.groupBy({ by: ['itemId', 'direction'], _sum: { qty: true } }),
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

  // Stock summary — opening + inward − outward, valued at the item's rate.
  const inByItem = new Map<string, number>();
  const outByItem = new Map<string, number>();
  for (const g of invSums) {
    (g.direction === 'IN' ? inByItem : outByItem).set(g.itemId, n(g._sum.qty));
  }
  const stockRows: StockRow[] = items.map((it) => {
    const inQty = (inByItem.get(it.id) ?? 0) + n(it.openingQty);
    const outQty = outByItem.get(it.id) ?? 0;
    const closingQty = Math.round((inQty - outQty) * 1000) / 1000;
    const rate = n(it.openingRate);
    return {
      id: it.id, name: it.name, unit: it.unit, gstRate: n(it.gstRate),
      inQty, outQty, closingQty, rate, value: Math.round(closingQty * rate * 100) / 100,
    };
  });

  return {
    ledgers: ledgerRows,
    vouchers: voucherRows,
    stock: stockRows,
    trial: {
      rows: trialRows,
      totalDebit: Math.round(totalDebit * 100) / 100,
      totalCredit: Math.round(totalCredit * 100) / 100,
      balanced: Math.round(totalDebit * 100) === Math.round(totalCredit * 100),
    },
    totals: { ledgers: ledgers.length, vouchers: await prisma.tallyVoucher.count(), stock: items.length },
  };
}
