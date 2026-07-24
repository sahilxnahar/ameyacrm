/**
 * Expense categories for vendor payments, mapped to the chart-of-accounts codes
 * the ledger already uses. Stored on a voucher as `accountCode`, so the finance
 * reports can slice spend by category. Keeping the keyword list here means the
 * importer, the add-payment form and the reports all agree on one definition.
 */
export interface ExpenseCategory {
  code: string;
  label: string;
  keywords: string[];
}

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  { code: '5200', label: 'Approvals & statutory fees', keywords: ['bbmp', 'bescom', 'sanction', 'khata', 'katha', 'rera', 'plan approval', 'statutory', 'govt', 'government', 'challan', 'eb connection', 'temp eb'] },
  { code: '5300', label: 'Materials', keywords: ['steel', 'cement', 'sand', 'jsw', 'material', 'bricks', 'tmt', 'aggregate', 'rmc', 'concrete', 'tiles'] },
  { code: '5400', label: 'Labour & sub-contractors', keywords: ['arun', 'labour', 'labor', 'construction', 'contractor', 'borewell', 'solar', 'cctv', 'auctus', 'mason', 'trees', 'trimm', 'site work'] },
  { code: '5500', label: 'Professional fees', keywords: ['roc', 'legal', 'gst', 'trademark', ' tm', 'vineet', 'professional', 'consultant', 'audit', 'soil test', 'geofrontier', 'architect', 'advocate', 'ca '] },
  { code: '6000', label: 'Overheads & admin', keywords: ['google', 'workspace', 'monitor', 'office', 'admin', 'subscription', 'reimburse', 'stationery', 'internet'] },
];

export const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c.code, c.label]));

/** Best-guess category for a payment from its payee name + note. Falls back to overheads. */
export function categorizeExpense(text: string): string {
  const t = ` ${(text || '').toLowerCase()} `;
  for (const c of EXPENSE_CATEGORIES) {
    if (c.keywords.some((k) => t.includes(k))) return c.code;
  }
  return '6000';
}
