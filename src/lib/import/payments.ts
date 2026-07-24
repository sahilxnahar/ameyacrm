/**
 * Pure parsing/classification for the vendor-payment importer (H5).
 *
 * Kept free of the database so the robustness rules — what counts as a blank
 * row, a bad amount, or a valid payment, and how amounts/dates/modes are read
 * from messy spreadsheet text — can be unit-tested directly.
 */
export type PaymentMode = 'CASH' | 'UPI' | 'CHEQUE' | 'BANK_TRANSFER';

/** Read an amount from free text like "₹1,20,000", "50000", "1.2" — 0 if unreadable. */
export function parsePaymentAmount(s: string): number {
  const n = Number((s ?? '').replace(/[₹,\s]/g, '').replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/** Read dd/mm/yyyy, dd-mm-yyyy, or anything Date understands. null if unreadable. */
export function parsePaymentDate(s: string): Date | null {
  const v = (s ?? '').trim();
  if (!v) return null;
  const m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/.exec(v);
  if (m) {
    const [, d, mo, y] = m;
    const yr = y!.length === 2 ? `20${y}` : y;
    const dt = new Date(Number(yr), Number(mo) - 1, Number(d));
    return isNaN(dt.getTime()) ? null : dt;
  }
  const dt = new Date(v);
  return isNaN(dt.getTime()) ? null : dt;
}

/** Map a free-text payment method to one of our modes. Defaults to bank transfer. */
export function paymentMode(raw: string): PaymentMode {
  const s = (raw ?? '').toLowerCase();
  return /cash/.test(s) ? 'CASH' : /upi/.test(s) ? 'UPI' : /cheque/.test(s) ? 'CHEQUE' : 'BANK_TRANSFER';
}

export type RowClassification =
  | { kind: 'ok'; name: string; amount: number }
  | { kind: 'blank' }
  | { kind: 'badAmount'; name: string; raw: string };

/** Decide what a row is before we touch the database: blank, bad amount, or valid. */
export function classifyPaymentRow(nameRaw: string, amountRaw: string): RowClassification {
  const name = (nameRaw ?? '').trim();
  if (!name) return { kind: 'blank' };
  const raw = (amountRaw ?? '').trim();
  const amount = parsePaymentAmount(raw);
  if (!(amount > 0)) return { kind: 'badAmount', name, raw };
  return { kind: 'ok', name, amount };
}
