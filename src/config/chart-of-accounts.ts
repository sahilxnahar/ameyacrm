import type { AccountType, NormalSide } from '@prisma/client';

/**
 * The opening chart of accounts for a real-estate development LLP.
 *
 * Codes are deliberate and permanent: posting rules refer to accounts by code,
 * never by name, so renaming "Sub-contractors" to "Contractors" later cannot
 * silently break the posting of every contractor bill.
 *
 * The numbering follows the usual convention — 1xxx assets, 2xxx liabilities,
 * 3xxx equity, 4xxx income, 5xxx and 6xxx expenses — because your accountant
 * will already expect it.
 */
export interface SeedAccount {
  code: string;
  name: string;
  type: AccountType;
  parent?: string;
  isGroup?: boolean;
  note?: string;
}

export const CHART_OF_ACCOUNTS: SeedAccount[] = [
  // ── Assets ───────────────────────────────────────────────────────────────
  { code: '1000', name: 'Assets', type: 'ASSET', isGroup: true },
  { code: '1100', name: 'Current assets', type: 'ASSET', parent: '1000', isGroup: true },
  { code: '1110', name: 'Cash in hand', type: 'ASSET', parent: '1100' },
  { code: '1120', name: 'Bank accounts', type: 'ASSET', parent: '1100', isGroup: true },
  { code: '1121', name: 'Bank — current account', type: 'ASSET', parent: '1120' },
  { code: '1122', name: 'Bank — RERA designated account', type: 'ASSET', parent: '1120', note: 'The 70% that may only be withdrawn against certified progress.' },
  { code: '1130', name: 'Receivables from buyers', type: 'ASSET', parent: '1100' },
  { code: '1140', name: 'Advances to vendors', type: 'ASSET', parent: '1100' },
  { code: '1150', name: 'Input GST credit', type: 'ASSET', parent: '1100', isGroup: true },
  { code: '1151', name: 'Input CGST', type: 'ASSET', parent: '1150' },
  { code: '1152', name: 'Input SGST', type: 'ASSET', parent: '1150' },
  { code: '1153', name: 'Input IGST', type: 'ASSET', parent: '1150' },
  { code: '1160', name: 'TDS receivable', type: 'ASSET', parent: '1100' },
  { code: '1170', name: 'Deposits and retentions held by others', type: 'ASSET', parent: '1100' },

  { code: '1200', name: 'Work in progress', type: 'ASSET', parent: '1000', isGroup: true, note: 'Development cost capitalised until a unit is sold.' },
  { code: '1210', name: 'Land and development rights', type: 'ASSET', parent: '1200' },
  { code: '1220', name: 'Construction work in progress', type: 'ASSET', parent: '1200' },
  { code: '1230', name: 'Approvals and statutory costs', type: 'ASSET', parent: '1200' },

  { code: '1300', name: 'Fixed assets', type: 'ASSET', parent: '1000', isGroup: true },
  { code: '1310', name: 'Plant and machinery', type: 'ASSET', parent: '1300' },
  { code: '1320', name: 'Office equipment', type: 'ASSET', parent: '1300' },
  { code: '1330', name: 'Vehicles', type: 'ASSET', parent: '1300' },
  { code: '1390', name: 'Accumulated depreciation', type: 'ASSET', parent: '1300', note: 'Contra-asset: normally carries a credit balance.' },

  // ── Liabilities ──────────────────────────────────────────────────────────
  { code: '2000', name: 'Liabilities', type: 'LIABILITY', isGroup: true },
  { code: '2100', name: 'Current liabilities', type: 'LIABILITY', parent: '2000', isGroup: true },
  { code: '2110', name: 'Payable to vendors', type: 'LIABILITY', parent: '2100' },
  { code: '2120', name: 'Advances from buyers', type: 'LIABILITY', parent: '2100', note: 'Money received before revenue is recognised.' },
  { code: '2130', name: 'Retention payable', type: 'LIABILITY', parent: '2100' },
  { code: '2140', name: 'Output GST', type: 'LIABILITY', parent: '2100', isGroup: true },
  { code: '2141', name: 'Output CGST', type: 'LIABILITY', parent: '2140' },
  { code: '2142', name: 'Output SGST', type: 'LIABILITY', parent: '2140' },
  { code: '2143', name: 'Output IGST', type: 'LIABILITY', parent: '2140' },
  { code: '2150', name: 'TDS payable', type: 'LIABILITY', parent: '2100' },
  { code: '2160', name: 'Statutory dues — PF, ESI, PT', type: 'LIABILITY', parent: '2100' },
  { code: '2170', name: 'Salaries payable', type: 'LIABILITY', parent: '2100' },
  { code: '2180', name: 'Security deposits received', type: 'LIABILITY', parent: '2100' },
  { code: '2200', name: 'Borrowings', type: 'LIABILITY', parent: '2000', isGroup: true },
  { code: '2210', name: 'Project loan', type: 'LIABILITY', parent: '2200' },
  { code: '2220', name: 'Unsecured loans from partners', type: 'LIABILITY', parent: '2200' },

  // ── Equity ───────────────────────────────────────────────────────────────
  { code: '3000', name: 'Partners\' capital', type: 'EQUITY', isGroup: true },
  { code: '3100', name: 'Capital contribution', type: 'EQUITY', parent: '3000' },
  { code: '3200', name: 'Drawings', type: 'EQUITY', parent: '3000' },
  { code: '3300', name: 'Retained earnings', type: 'EQUITY', parent: '3000' },

  // ── Income ───────────────────────────────────────────────────────────────
  { code: '4000', name: 'Income', type: 'INCOME', isGroup: true },
  { code: '4100', name: 'Sale of units', type: 'INCOME', parent: '4000' },
  { code: '4200', name: 'Rental income', type: 'INCOME', parent: '4000' },
  { code: '4300', name: 'Interest on delayed payments', type: 'INCOME', parent: '4000' },
  { code: '4400', name: 'Other income', type: 'INCOME', parent: '4000' },

  // ── Direct costs ─────────────────────────────────────────────────────────
  { code: '5000', name: 'Direct project costs', type: 'EXPENSE', isGroup: true },
  { code: '5100', name: 'Land cost', type: 'EXPENSE', parent: '5000' },
  { code: '5200', name: 'Approvals and statutory fees', type: 'EXPENSE', parent: '5000', isGroup: true },
  { code: '5210', name: 'BBMP and BDA charges', type: 'EXPENSE', parent: '5200' },
  { code: '5220', name: 'BESCOM and BWSSB charges', type: 'EXPENSE', parent: '5200' },
  { code: '5230', name: 'RERA and registration fees', type: 'EXPENSE', parent: '5200' },
  { code: '5240', name: 'Other statutory and panchayat fees', type: 'EXPENSE', parent: '5200' },
  { code: '5300', name: 'Materials', type: 'EXPENSE', parent: '5000', isGroup: true },
  { code: '5310', name: 'Cement', type: 'EXPENSE', parent: '5300' },
  { code: '5320', name: 'Steel', type: 'EXPENSE', parent: '5300' },
  { code: '5330', name: 'Aggregates and sand', type: 'EXPENSE', parent: '5300' },
  { code: '5340', name: 'Blocks and bricks', type: 'EXPENSE', parent: '5300' },
  { code: '5350', name: 'Finishing materials', type: 'EXPENSE', parent: '5300' },
  { code: '5390', name: 'Other materials', type: 'EXPENSE', parent: '5300' },
  { code: '5400', name: 'Labour and sub-contractors', type: 'EXPENSE', parent: '5000', isGroup: true },
  { code: '5410', name: 'Civil contractor', type: 'EXPENSE', parent: '5400' },
  { code: '5420', name: 'Electrical contractor', type: 'EXPENSE', parent: '5400' },
  { code: '5430', name: 'Plumbing contractor', type: 'EXPENSE', parent: '5400' },
  { code: '5440', name: 'Finishing contractors', type: 'EXPENSE', parent: '5400' },
  { code: '5450', name: 'Daily-wage labour', type: 'EXPENSE', parent: '5400' },
  { code: '5500', name: 'Professional fees', type: 'EXPENSE', parent: '5000', isGroup: true },
  { code: '5510', name: 'Architect', type: 'EXPENSE', parent: '5500' },
  { code: '5520', name: 'Structural consultant', type: 'EXPENSE', parent: '5500' },
  { code: '5530', name: 'MEP consultant', type: 'EXPENSE', parent: '5500' },
  { code: '5540', name: 'Legal and liaison', type: 'EXPENSE', parent: '5500' },
  { code: '5600', name: 'Plant hire and site running', type: 'EXPENSE', parent: '5000' },

  // ── Indirect costs ───────────────────────────────────────────────────────
  { code: '6000', name: 'Overheads', type: 'EXPENSE', isGroup: true },
  { code: '6100', name: 'Salaries and wages', type: 'EXPENSE', parent: '6000' },
  { code: '6200', name: 'Marketing and advertising', type: 'EXPENSE', parent: '6000' },
  { code: '6300', name: 'Brokerage and commission', type: 'EXPENSE', parent: '6000' },
  { code: '6400', name: 'Office rent and utilities', type: 'EXPENSE', parent: '6000' },
  { code: '6500', name: 'Travel and conveyance', type: 'EXPENSE', parent: '6000' },
  { code: '6600', name: 'Bank charges', type: 'EXPENSE', parent: '6000' },
  { code: '6700', name: 'Interest', type: 'EXPENSE', parent: '6000' },
  { code: '6800', name: 'Depreciation', type: 'EXPENSE', parent: '6000' },
  { code: '6900', name: 'Miscellaneous', type: 'EXPENSE', parent: '6000' },
];

/** Which side increases an account of this type. */
export function normalSide(type: AccountType): NormalSide {
  return type === 'ASSET' || type === 'EXPENSE' ? 'DEBIT' : 'CREDIT';
}

/**
 * Accounts the posting rules depend on. Named here so that a missing one is a
 * loud failure at seed time rather than a silent mis-posting later.
 */
export const REQUIRED_CODES = [
  '1110', '1121', '1130', '1140', '1151', '1152', '1220',
  '2110', '2120', '2141', '2142', '2150',
  '4100', '5390', '6900',
] as const;
