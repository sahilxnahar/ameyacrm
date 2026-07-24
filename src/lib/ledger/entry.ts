/**
 * Building and checking a journal entry, with no database involved.
 *
 * Kept pure so the rules that protect the books can be tested directly and
 * exhaustively. Everything here works in paise (integers), because the whole
 * point of double entry is that two sides are *exactly* equal, and floating
 * point cannot promise that: 0.1 + 0.2 is famously not 0.3, and a ledger built
 * on that drifts by paise, then by rupees, and then nobody trusts it.
 */

export interface DraftLine {
  accountCode: string;
  /** Rupees. Converted to paise the moment it arrives. */
  debit?: number | string;
  credit?: number | string;
  narration?: string;
  vendorId?: string | null;
  customerId?: string | null;
  projectId?: string | null;
  costCode?: string | null;
}

export interface CheckedLine {
  accountCode: string;
  debitPaise: number;
  creditPaise: number;
  narration?: string;
  vendorId?: string | null;
  customerId?: string | null;
  projectId?: string | null;
  costCode?: string | null;
}

export interface CheckedEntry {
  lines: CheckedLine[];
  totalPaise: number;
}

/** Rupees (number, string, or Prisma Decimal) to whole paise. */
export function toPaise(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return 0;
  const raw = typeof v === 'object' ? String(v) : v;

  let n: number;
  if (typeof raw === 'number') {
    n = raw;
  } else {
    // Strip currency symbols, spaces and Indian digit grouping, but do NOT
    // accept whatever is left by default. "abc" strips to "" and Number('')
    // is 0 — which would silently record a payment of nothing. That exact
    // mistake has been made in this codebase before.
    const cleaned = String(raw).replace(/[^0-9.\-]/g, '');
    if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
    n = Number(cleaned);
  }
  if (!Number.isFinite(n)) return null;
  // Round rather than truncate: 0.1 * 100 is 10.000000000000002 in binary
  // floating point, and truncating would lose a paisa on perfectly ordinary
  // amounts.
  return Math.round(n * 100);
}

export const rupees = (paise: number): number => Math.round(paise) / 100;

export type CheckResult = { ok: true; entry: CheckedEntry } | { ok: false; error: string };

/**
 * Refuse anything that is not a valid double entry.
 *
 * This is the single most important function in the ledger. Everything else
 * assumes the books balance; this is what makes that assumption true.
 */
export function checkEntry(draft: DraftLine[]): CheckResult {
  if (!Array.isArray(draft) || draft.length < 2) {
    return { ok: false, error: 'An entry needs at least two lines - something given and something received.' };
  }

  const lines: CheckedLine[] = [];
  let debits = 0;
  let credits = 0;

  for (const [i, l] of draft.entries()) {
    if (!l.accountCode) return { ok: false, error: `Line ${i + 1} has no account.` };

    const d = toPaise(l.debit);
    const c = toPaise(l.credit);
    if (d === null || c === null) return { ok: false, error: `Line ${i + 1} has an amount that is not a number.` };
    if (d < 0 || c < 0) return { ok: false, error: `Line ${i + 1} has a negative amount. Put it on the other side instead.` };
    if (d > 0 && c > 0) return { ok: false, error: `Line ${i + 1} is both a debit and a credit. It must be one or the other.` };
    if (d === 0 && c === 0) return { ok: false, error: `Line ${i + 1} has no amount.` };

    debits += d;
    credits += c;
    lines.push({
      accountCode: l.accountCode,
      debitPaise: d,
      creditPaise: c,
      narration: l.narration,
      vendorId: l.vendorId ?? null,
      customerId: l.customerId ?? null,
      projectId: l.projectId ?? null,
      costCode: l.costCode ?? null,
    });
  }

  if (debits !== credits) {
    const diff = rupees(Math.abs(debits - credits));
    return {
      ok: false,
      error: `This entry does not balance. Debits come to Rs ${rupees(debits).toLocaleString('en-IN')} and credits to Rs ${rupees(credits).toLocaleString('en-IN')} - a difference of Rs ${diff.toLocaleString('en-IN')}.`,
    };
  }
  if (debits === 0) return { ok: false, error: 'An entry for nothing cannot be posted.' };

  return { ok: true, entry: { lines, totalPaise: debits } };
}

/**
 * The opposite of an entry: every debit becomes a credit and vice versa.
 * Reversal is the only way to undo a posted entry - see the note in the schema.
 */
export function reverseLines(lines: CheckedLine[]): CheckedLine[] {
  return lines.map((l) => ({ ...l, debitPaise: l.creditPaise, creditPaise: l.debitPaise }));
}

/** Does this account type increase on the debit side? */
export function isDebitNormal(type: string): boolean {
  return type === 'ASSET' || type === 'EXPENSE';
}

/**
 * The balance of an account, signed so that a positive number always means
 * "more of what this account is for" regardless of which side it sits on.
 */
export function signedBalance(type: string, debitPaise: number, creditPaise: number): number {
  return isDebitNormal(type) ? debitPaise - creditPaise : creditPaise - debitPaise;
}
