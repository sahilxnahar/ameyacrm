import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { startOfTodayIST } from '@/lib/date/ist';
import {
  AGEING_BUCKETS, bucketFor, emptyBuckets,
  type BillWiseReport, type BucketKey, type OpenBill, type PartyAgeing,
} from '@/lib/tally/bills-shared';

// Re-exported so existing server-side imports keep working.
export { AGEING_BUCKETS };
export type { BillWiseReport, BucketKey, OpenBill, PartyAgeing };

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

const n = (d: unknown) => (d == null ? 0 : Number(d));

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
