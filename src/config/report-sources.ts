/**
 * The report builder is deliberately closed: a person can only report on a
 * source that appears in this whitelist, and can only group by / measure the
 * fields listed for it. Nothing in the builder turns user input into a query —
 * the service reads this table, fetches the named source, and hands the rows to
 * the pure `aggregate()` engine. That is what keeps it safe.
 *
 * This file is plain data (no imports of server code), so it is safe to import
 * from a client component to render the dropdowns.
 */

export interface ReportField {
  key: string;
  label: string;
}

export interface ReportSource {
  key: string;
  label: string;
  /** Fields a person may group rows by. */
  groupBy: ReportField[];
  /** Numeric fields a person may sum or average. */
  values: ReportField[];
}

export const REPORT_SOURCES: ReportSource[] = [
  {
    key: 'leads',
    label: 'Leads',
    groupBy: [
      { key: 'status', label: 'Status' },
      { key: 'source', label: 'Source' },
      { key: 'temperature', label: 'Temperature' },
    ],
    values: [{ key: 'score', label: 'Lead score' }],
  },
  {
    key: 'bookings',
    label: 'Bookings',
    groupBy: [
      { key: 'status', label: 'Status' },
      { key: 'paymentStatus', label: 'Payment status' },
    ],
    values: [{ key: 'agreementValue', label: 'Agreement value' }],
  },
  {
    key: 'tasks',
    label: 'Tasks',
    groupBy: [
      { key: 'status', label: 'Status' },
      { key: 'priority', label: 'Priority' },
    ],
    values: [],
  },
  {
    key: 'vouchers',
    label: 'Payments (vouchers)',
    groupBy: [
      { key: 'kind', label: 'Kind' },
      { key: 'status', label: 'Status' },
    ],
    values: [{ key: 'amount', label: 'Amount' }],
  },
  {
    key: 'expenses',
    label: 'Expense claims',
    groupBy: [
      { key: 'status', label: 'Status' },
      { key: 'category', label: 'Category' },
    ],
    values: [{ key: 'amount', label: 'Amount' }],
  },
];

export const METRICS = [
  { key: 'count', label: 'Count' },
  { key: 'sum', label: 'Sum' },
  { key: 'avg', label: 'Average' },
] as const;

export function sourceByKey(key: string): ReportSource | undefined {
  return REPORT_SOURCES.find((s) => s.key === key);
}
