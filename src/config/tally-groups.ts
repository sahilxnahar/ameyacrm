/**
 * The standard Indian chart-of-accounts group set used by Ameya Tally, with each
 * group's accounting nature. "Nature" drives which financial statement a ledger
 * lands in and its normal side. This is standard accounting classification, not
 * anything proprietary.
 */
export type Nature = 'ASSET' | 'LIABILITY' | 'INCOME' | 'EXPENSE';

export interface TallyGroup {
  name: string;
  nature: Nature;
}

export const TALLY_GROUPS: TallyGroup[] = [
  // Assets
  { name: 'Bank Accounts', nature: 'ASSET' },
  { name: 'Cash-in-Hand', nature: 'ASSET' },
  { name: 'Current Assets', nature: 'ASSET' },
  { name: 'Deposits (Asset)', nature: 'ASSET' },
  { name: 'Fixed Assets', nature: 'ASSET' },
  { name: 'Investments', nature: 'ASSET' },
  { name: 'Loans & Advances (Asset)', nature: 'ASSET' },
  { name: 'Stock-in-Hand', nature: 'ASSET' },
  { name: 'Sundry Debtors', nature: 'ASSET' },
  // Liabilities
  { name: 'Bank OD A/c', nature: 'LIABILITY' },
  { name: 'Capital Account', nature: 'LIABILITY' },
  { name: 'Current Liabilities', nature: 'LIABILITY' },
  { name: 'Duties & Taxes', nature: 'LIABILITY' },
  { name: 'Loans (Liability)', nature: 'LIABILITY' },
  { name: 'Provisions', nature: 'LIABILITY' },
  { name: 'Reserves & Surplus', nature: 'LIABILITY' },
  { name: 'Secured Loans', nature: 'LIABILITY' },
  { name: 'Sundry Creditors', nature: 'LIABILITY' },
  { name: 'Suspense A/c', nature: 'LIABILITY' },
  { name: 'Unsecured Loans', nature: 'LIABILITY' },
  // Income
  { name: 'Sales Accounts', nature: 'INCOME' },
  { name: 'Direct Incomes', nature: 'INCOME' },
  { name: 'Indirect Incomes', nature: 'INCOME' },
  // Expenses
  { name: 'Purchase Accounts', nature: 'EXPENSE' },
  { name: 'Direct Expenses', nature: 'EXPENSE' },
  { name: 'Indirect Expenses', nature: 'EXPENSE' },
];

export const GROUP_NAMES = TALLY_GROUPS.map((g) => g.name);

const NATURE_OF = new Map(TALLY_GROUPS.map((g) => [g.name, g.nature]));
export function natureOfGroup(group: string): Nature {
  return NATURE_OF.get(group) ?? 'ASSET';
}
/** The normal side of a group's ledgers (assets & expenses debit; the rest credit). */
export function normalSide(group: string): 'Dr' | 'Cr' {
  const n = natureOfGroup(group);
  return n === 'ASSET' || n === 'EXPENSE' ? 'Dr' : 'Cr';
}

/** Ledgers Tally auto-creates in a fresh company. */
export const DEFAULT_LEDGERS: Array<{ name: string; group: string; system: boolean }> = [
  { name: 'Cash', group: 'Cash-in-Hand', system: true },
  { name: 'Profit & Loss A/c', group: 'Reserves & Surplus', system: true },
];

export const VOUCHER_TYPES = ['Contra', 'Payment', 'Receipt', 'Journal', 'Sales', 'Purchase'] as const;
export type VoucherType = (typeof VOUCHER_TYPES)[number];
/** The function key Tally-style users press for each voucher type. */
export const VOUCHER_KEY: Record<VoucherType, string> = {
  Contra: 'F4', Payment: 'F5', Receipt: 'F6', Journal: 'F7', Sales: 'F8', Purchase: 'F9',
};
