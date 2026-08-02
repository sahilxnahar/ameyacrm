/**
 * Bill-wise shapes and the ageing buckets, shared by server and browser.
 *
 * Deliberately free of `server-only` and of any database import: the ageing
 * screen is a client component and needs the bucket definitions to render its
 * summary. Keeping them here means the two sides cannot drift — the labels on
 * screen are the same constants the report is computed from.
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

export const emptyBuckets = (): Record<BucketKey, number> =>
  Object.fromEntries(AGEING_BUCKETS.map((b) => [b.key, 0])) as Record<BucketKey, number>;

export function bucketFor(daysOverdue: number): BucketKey {
  for (const b of AGEING_BUCKETS) {
    if (daysOverdue >= b.from && daysOverdue <= b.to) return b.key;
  }
  return 'd90p';
}
