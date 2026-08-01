import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { startOfTodayIST } from '@/lib/date/ist';

/**
 * Bill-wise outstanding and ageing.
 *
 * The difference from the old report matters. That one took a party's charges
 * and payments and matched them oldest-first, which is a guess: a buyer who
 * pays the third instalment while disputing the second shows up as having
 * settled the second, and the genuinely overdue amount hides. Here, money is
 * only set against a bill when somebody actually allocated it, so "what is
 * overdue" is a fact rather than an inference.
 */

/** Standard Indian ageing buckets, by days past the due date. */
export const AGEING_BUCKETS = [
  { key: 'notDue', label: 'Not yet due', from: -99999, to: -1 },
  { key: 'd0_30', label: '0–30 days', from: 0, to: 30 },
  { key: 'd31_60', label: '31–60 days', from: 31, to: 60 },
  { key: 'd61_90', label: '61–90 days', from: 61, to: 90 },
  { key: 'd90p', label: 'Over 90 days', from: 91, to: 99999 },
] as const;

export type BucketKey = (typeof AGEING_BUCKETS)[number]['key'];

export interface OpenBill {
  id: string;
  reference: string;
  party: string;
  ledgerId: string;
  billDate: string;
  dueDate: string | null;
  amount: number;
  settled: number;
  outstanding: number;
  daysOverdue: number;
  bucket: BucketKey;
  narration: string | null;
}

export interface PartyAgeing {
  ledgerId: string;
  party: string;
  total: number;
  buckets: Record<BucketKey, number>;
  bills: OpenBill[];
  oldestOverdueDays: number;
}

export interface BillWiseReport {
  receivables: PartyAgeing[];
  payables: PartyAgeing[];
  totals: {
    receivable: number;
    payable: number;
    receivableBuckets: Record<BucketKey, number>;
    payableBuckets: Record<BucketKey, number>;
  };
  asAt: string;
}

const n = (d: unknown) => (d == null ? 0 : Number(d));
const emptyBuckets = (): Record<BucketKey, number> =>
  Object.fromEntries(AGEING_BUCKETS.map((b) => [b.key, 0])) as Record<BucketKey, number>;

function bucketFor(daysOverdue: number): BucketKey {
  for (const b of AGEING_BUCKETS) {
    if (daysOverdue >= b.from && daysOverdue <= b.to) return b.key;
  }
  return 'd90p';
}

export async function getBillWiseReport(companyId: string, asAt = new Date()): Promise<BillWiseReport> {
  const bills = await prisma.tallyBill.findMany({
    where: { companyId },
    include: {
      ledger: { select: { id: true, name: true } },
      allocations: { select: { amount: true } },
    },
    orderBy: [{ dueDate: 'asc' }, { billDate: 'asc' }],
    take: 5000,
  }).catch(() => []);

  const today = startOfTodayIST(asAt);
  const byParty = new Map<string, PartyAgeing>();
  const totals = { receivable: 0, payable: 0, receivableBuckets: emptyBuckets(), payableBuckets: emptyBuckets() };

  for (const b of bills) {
    const amount = n(b.amount);
    const settled = b.allocations.reduce((s, a) => s + n(a.amount), 0);
    const outstanding = Math.round((amount - settled) * 100) / 100;
    // A fully settled bill is history, not outstanding. Over-allocation (a
    // credit note, or an overpayment) is treated as settled rather than shown
    // as a negative that muddles the totals.
    if (outstanding <= 0.005) continue;

    const due = b.dueDate ?? b.billDate;
    const daysOverdue = Math.floor((today.getTime() - due.getTime()) / 86400_000);
    const bucket = bucketFor(daysOverdue);

    const key = `${b.kind}:${b.ledgerId}`;
    let party = byParty.get(key);
    if (!party) {
      party = {
        ledgerId: b.ledgerId, party: b.ledger?.name ?? '(unknown)',
        total: 0, buckets: emptyBuckets(), bills: [], oldestOverdueDays: 0,
      };
      byParty.set(key, party);
    }

    party.total = Math.round((party.total + outstanding) * 100) / 100;
    party.buckets[bucket] = Math.round((party.buckets[bucket] + outstanding) * 100) / 100;
    party.oldestOverdueDays = Math.max(party.oldestOverdueDays, daysOverdue);
    party.bills.push({
      id: b.id, reference: b.reference, party: party.party, ledgerId: b.ledgerId,
      billDate: b.billDate.toISOString().slice(0, 10),
      dueDate: b.dueDate ? b.dueDate.toISOString().slice(0, 10) : null,
      amount, settled, outstanding, daysOverdue, bucket, narration: b.narration,
    });

    if (b.kind === 'PAYABLE') {
      totals.payable = Math.round((totals.payable + outstanding) * 100) / 100;
      totals.payableBuckets[bucket] = Math.round((totals.payableBuckets[bucket] + outstanding) * 100) / 100;
    } else {
      totals.receivable = Math.round((totals.receivable + outstanding) * 100) / 100;
      totals.receivableBuckets[bucket] = Math.round((totals.receivableBuckets[bucket] + outstanding) * 100) / 100;
    }
  }

  const split = (kind: string) =>
    [...byParty.entries()]
      .filter(([k]) => k.startsWith(`${kind}:`))
      .map(([, v]) => v)
      // Worst first — the point of the screen is who to chase today.
      .sort((a, b) => b.oldestOverdueDays - a.oldestOverdueDays || b.total - a.total);

  return {
    receivables: split('RECEIVABLE'),
    payables: split('PAYABLE'),
    totals,
    asAt: asAt.toISOString().slice(0, 10),
  };
}

/** Bills on one party that still have something outstanding — for allocation. */
export async function getOpenBillsFor(companyId: string, ledgerId: string): Promise<OpenBill[]> {
  const report = await getBillWiseReport(companyId);
  return [...report.receivables, ...report.payables]
    .filter((p) => p.ledgerId === ledgerId)
    .flatMap((p) => p.bills);
}
