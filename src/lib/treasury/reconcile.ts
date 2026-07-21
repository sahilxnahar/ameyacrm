/**
 * Bank reconciliation matching, kept pure so it can be tested without a
 * database and without a live statement.
 *
 * The single highest-value thing in the cash-flow batch is matching a line on a
 * bank statement to a payment already recorded in the system. Because every
 * voucher carries a UTR, an exact match on that reference is both cheap and
 * certain — a UTR is unique to one transfer. What is left over after that is
 * matched more cautiously, by amount and date, and always surfaced for a human
 * rather than booked silently.
 *
 * Nothing here reads the clock; the caller supplies the tolerance in days.
 */

export interface StatementLineInput {
  id: string;
  date: Date;
  /** Signed: positive is money in (credit), negative is money out (debit). */
  amount: number;
  refNo: string | null;
  description: string;
}

export interface VoucherCandidate {
  id: string;
  number: string;
  utr: string | null;
  /** Always positive; direction is carried by `direction`. */
  amount: number;
  date: Date;
  partyName: string;
  /** IN = receipt (expect a credit line), OUT = payment (expect a debit line). */
  direction: 'IN' | 'OUT';
}

export type MatchConfidence = 'EXACT_UTR' | 'AMOUNT_DATE';

export interface Match {
  lineId: string;
  voucherId: string;
  confidence: MatchConfidence;
  /** Days between the line and the voucher; 0 for a UTR match we did not date-check. */
  dayGap: number;
}

export interface ReconResult {
  matches: Match[];
  unmatchedLineIds: string[];
  unmatchedVoucherIds: string[];
}

const DAY = 86_400_000;
function dayGap(a: Date, b: Date): number {
  const x = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const y = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.abs(Math.round((x - y) / DAY));
}

/** Uppercase and strip everything that is not a letter or digit, so "UTR: 1234-5678"
 *  and "utr12345678" compare equal. */
function normalizeRef(s: string | null): string {
  return (s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

const paise = (n: number) => Math.round(n * 100);

/**
 * Match statement lines to vouchers in two passes.
 *
 * Pass 1 — exact UTR. A voucher's UTR, normalized, appearing anywhere in the
 * line's reference or narration is treated as certain. Each side is consumed so
 * nothing matches twice.
 *
 * Pass 2 — amount and date. Of what remains, a line matches a voucher when the
 * magnitude is equal to the paise, the direction agrees (a credit to a receipt,
 * a debit to a payment) and the dates are within `withinDays`. Ties are broken
 * by the smallest date gap, then by voucher number for determinism.
 */
export function reconcile(
  lines: StatementLineInput[],
  vouchers: VoucherCandidate[],
  withinDays = 4,
): ReconResult {
  const matches: Match[] = [];
  const lineUsed = new Set<string>();
  const vchUsed = new Set<string>();

  // Pass 1: UTR
  for (const line of lines) {
    if (lineUsed.has(line.id)) continue;
    const hay = normalizeRef(line.refNo) + '|' + normalizeRef(line.description);
    for (const v of vouchers) {
      if (vchUsed.has(v.id)) continue;
      const utr = normalizeRef(v.utr);
      if (utr.length >= 6 && hay.includes(utr)) {
        matches.push({ lineId: line.id, voucherId: v.id, confidence: 'EXACT_UTR', dayGap: dayGap(line.date, v.date) });
        lineUsed.add(line.id);
        vchUsed.add(v.id);
        break;
      }
    }
  }

  // Pass 2: amount + direction + date proximity
  for (const line of lines) {
    if (lineUsed.has(line.id)) continue;
    const wantDirection = line.amount >= 0 ? 'IN' : 'OUT';
    const mag = Math.abs(paise(line.amount));
    let best: { v: VoucherCandidate; gap: number } | null = null;
    for (const v of vouchers) {
      if (vchUsed.has(v.id)) continue;
      if (v.direction !== wantDirection) continue;
      if (paise(v.amount) !== mag) continue;
      const gap = dayGap(line.date, v.date);
      if (gap > withinDays) continue;
      if (!best || gap < best.gap || (gap === best.gap && v.number < best.v.number)) {
        best = { v, gap };
      }
    }
    if (best) {
      matches.push({ lineId: line.id, voucherId: best.v.id, confidence: 'AMOUNT_DATE', dayGap: best.gap });
      lineUsed.add(line.id);
      vchUsed.add(best.v.id);
    }
  }

  return {
    matches,
    unmatchedLineIds: lines.filter((l) => !lineUsed.has(l.id)).map((l) => l.id),
    unmatchedVoucherIds: vouchers.filter((v) => !vchUsed.has(v.id)).map((v) => v.id),
  };
}

/**
 * Parse a bank statement pasted or uploaded as CSV.
 *
 * Indian bank exports vary wildly, so this is deliberately forgiving: it finds
 * the header row, maps common column names, and accepts either a single signed
 * "Amount" column or separate withdrawal/deposit columns. Amounts written the
 * Indian way — "1,50,000.00" — are handled. A row it cannot read is returned in
 * `skipped` rather than silently dropped, because a statement that half-imports
 * is worse than one that refuses.
 */
export interface ParsedLine {
  date: Date | null;
  description: string;
  refNo: string | null;
  amount: number;
}
export interface ParseResult {
  lines: ParsedLine[];
  skipped: Array<{ row: number; reason: string }>;
  columns: Record<string, number>;
}

function splitCsvRow(row: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < row.length; i++) {
    const c = row[i];
    if (c === '"') {
      if (q && row[i + 1] === '"') { cur += '"'; i++; } else q = !q;
    } else if (c === ',' && !q) { out.push(cur); cur = ''; } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function toAmount(raw: string): number | null {
  const cleaned = raw.replace(/[₹\s]/g, '').replace(/,/g, '');
  if (cleaned === '' || cleaned === '-') return null;
  const m = cleaned.match(/^-?[0-9]+(?:\.[0-9]+)?$/);
  if (!m) return null;
  return Number(cleaned);
}

function toDate(raw: string): Date | null {
  const s = raw.trim();
  // dd/mm/yyyy or dd-mm-yyyy (Indian bank default)
  let m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (m) {
    const day = +m[1]!, mon = +m[2]!, yr = m[3]!.length === 2 ? 2000 + +m[3]! : +m[3]!;
    if (mon >= 1 && mon <= 12 && day >= 1 && day <= 31) return new Date(Date.UTC(yr, mon - 1, day));
  }
  // yyyy-mm-dd
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!));
  return null;
}

// Match a header to a candidate name. Short two-letter aliases ("cr", "dr") must
// match the whole header exactly, never as a substring — otherwise "credit"
// binds to "des-CR-iption" and every money-in line is silently dropped. Longer
// candidates (>= 3 chars) may match as a substring so "credit" still finds
// "Credit Amount" and "ref" finds "Cheque Ref No".
const find = (headers: string[], names: string[]) =>
  headers.findIndex((h) => {
    const n = h.toLowerCase().replace(/[^a-z]/g, '');
    return names.some((name) => n === name || (name.length >= 3 && n.includes(name)));
  });

export function parseStatementCsv(text: string): ParseResult {
  const rows = text.split(/\r?\n/).map((r) => r.trimEnd()).filter((r) => r.trim() !== '');
  const skipped: Array<{ row: number; reason: string }> = [];
  if (rows.length === 0) return { lines: [], skipped, columns: {} };

  // Find the header: the first row that names a date and something money-like.
  let headerIdx = 0;
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const cells = splitCsvRow(rows[i]!).map((c) => c.toLowerCase());
    if (cells.some((c) => c.includes('date')) && cells.some((c) => /amount|withdrawal|deposit|debit|credit/.test(c))) {
      headerIdx = i;
      break;
    }
  }
  const headers = splitCsvRow(rows[headerIdx]!);
  const cols = {
    date: find(headers, ['date', 'txndate', 'valuedate']),
    desc: find(headers, ['narration', 'description', 'particulars', 'remarks', 'details']),
    ref: find(headers, ['ref', 'chq', 'utr', 'transactionid']),
    amount: find(headers, ['amount']),
    withdrawal: find(headers, ['withdrawal', 'debit', 'dr']),
    deposit: find(headers, ['deposit', 'credit', 'cr']),
    // 'dr'/'cr' above are two chars, so per `find` they only match a header that
    // *is* exactly "Dr"/"Cr" — never a substring of "Description"/"Address".
  };

  const lines: ParsedLine[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const cells = splitCsvRow(rows[i]!);
    const dateRaw = cols.date >= 0 ? cells[cols.date] ?? '' : '';
    const date = toDate(dateRaw);
    if (!date) { skipped.push({ row: i + 1, reason: `unreadable date "${dateRaw}"` }); continue; }

    let amount: number | null = null;
    if (cols.amount >= 0) {
      amount = toAmount(cells[cols.amount] ?? '');
    } else {
      const w = cols.withdrawal >= 0 ? toAmount(cells[cols.withdrawal] ?? '') : null;
      const dpo = cols.deposit >= 0 ? toAmount(cells[cols.deposit] ?? '') : null;
      if (dpo != null && dpo !== 0) amount = Math.abs(dpo);
      else if (w != null && w !== 0) amount = -Math.abs(w);
    }
    if (amount == null || amount === 0) { skipped.push({ row: i + 1, reason: 'no amount' }); continue; }

    lines.push({
      date,
      description: (cols.desc >= 0 ? cells[cols.desc] ?? '' : '').slice(0, 300),
      refNo: cols.ref >= 0 ? (cells[cols.ref] ?? '').slice(0, 120) || null : null,
      amount,
    });
  }

  return { lines, skipped, columns: cols as unknown as Record<string, number> };
}
