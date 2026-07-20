/** Voucher types, and what each one is called in plain English. */
export const VOUCHER_KINDS = [
  'CASH_RECEIVED', 'CASH_PAID', 'MATERIAL_RECEIVED', 'MATERIAL_ISSUED', 'BANK_RECEIVED', 'BANK_PAID',
] as const;
export type VoucherKind = (typeof VOUCHER_KINDS)[number];

export interface KindMeta {
  label: string;
  short: string;
  prefix: string;
  direction: 'in' | 'out';
  isMaterial: boolean;
  partyLabel: string;
  hint: string;
}

export const KIND_META: Record<VoucherKind, KindMeta> = {
  CASH_RECEIVED:     { label: 'Cash received',     short: 'Received', prefix: 'CR', direction: 'in',  isMaterial: false, partyLabel: 'Received from', hint: 'Money taken in hand — a token, an instalment, a refund coming back.' },
  CASH_PAID:         { label: 'Cash paid',         short: 'Paid',     prefix: 'CP', direction: 'out', isMaterial: false, partyLabel: 'Paid to',       hint: 'Money handed out — labour, transport, site expenses.' },
  BANK_RECEIVED:     { label: 'Bank received',     short: 'Received', prefix: 'BR', direction: 'in',  isMaterial: false, partyLabel: 'Received from', hint: 'Money into the account — a transfer, UPI or cheque cleared.' },
  BANK_PAID:         { label: 'Bank paid',         short: 'Paid',     prefix: 'BP', direction: 'out', isMaterial: false, partyLabel: 'Paid to',       hint: 'Money out of the account — a vendor bill, a salary, a refund.' },
  MATERIAL_RECEIVED: { label: 'Material received', short: 'In',       prefix: 'MR', direction: 'in',  isMaterial: true,  partyLabel: 'Received from', hint: 'Goods arriving at site — cement, steel, sand. Record the challan number.' },
  MATERIAL_ISSUED:   { label: 'Material issued',   short: 'Out',      prefix: 'MI', direction: 'out', isMaterial: true,  partyLabel: 'Issued to',     hint: 'Goods leaving the store — to a contractor, or to another site.' },
};

export const PAY_MODES = ['CASH', 'BANK_TRANSFER', 'UPI', 'CHEQUE', 'CARD', 'ADJUSTMENT'] as const;
export const PAY_MODE_LABEL: Record<string, string> = {
  CASH: 'Cash', BANK_TRANSFER: 'Bank transfer', UPI: 'UPI', CHEQUE: 'Cheque', CARD: 'Card', ADJUSTMENT: 'Adjustment',
};

export const UNITS = ['bags', 'nos', 'cft', 'sqft', 'kg', 'tonnes', 'litres', 'metres', 'trips', 'lot'];
