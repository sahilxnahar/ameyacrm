/**
 * Borrowings interest engine (reducing balance).
 *
 * Money is taken from banks and NBFCs in tranches — a drawdown here, another
 * there — and each rupee starts accruing interest from the day it lands, at the
 * facility's annual rate, on the *outstanding* balance (so it falls as you
 * repay). This computes, for one facility, how much has been drawn, repaid and
 * left outstanding, and the interest accrued to a given date.
 *
 * Pure and client-safe: no database, no env. Amounts are plain rupee Numbers
 * (treasury display figures, not ledger postings), day-count is actual/365.
 */

export type BorrowEventKind = 'DRAWDOWN' | 'REPAYMENT' | 'INTEREST' | 'FEE';

export interface BorrowEvent {
  kind: BorrowEventKind;
  amount: number;
  /** Date (or ISO string) the event happened. */
  date: Date | string;
}

export interface FacilityInterest {
  drawn: number;
  repaid: number;
  interestPaid: number;
  feePaid: number;
  /** Principal still outstanding (never below zero). */
  outstanding: number;
  /** Interest accrued on the reducing balance up to `asOf`. */
  interestAccrued: number;
  /** Accrued interest not yet paid off by INTEREST events (never below zero). */
  netInterestDue: number;
}

function toDate(d: Date | string): Date {
  return d instanceof Date ? d : new Date(d);
}

/** Whole days between two instants (actual/365 day-count), never negative. */
function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return ms <= 0 ? 0 : Math.floor(ms / 86_400_000);
}

/**
 * Accrue interest for one facility on a reducing balance.
 *
 * Walks the events in date order: interest accrues on the running principal for
 * the days between each event, a drawdown raises the principal from its own
 * date, a repayment lowers it, and interest/fee payments are tracked but do not
 * change the principal. Finally it accrues from the last event up to `asOf`.
 */
export function accrueFacilityInterest(
  events: BorrowEvent[],
  annualRatePct: number | null | undefined,
  asOf: Date | string = new Date(),
): FacilityInterest {
  const rate = annualRatePct == null ? 0 : Number(annualRatePct);
  const end = toDate(asOf);
  const sorted = [...events]
    .map((e) => ({ kind: e.kind, amount: Number(e.amount) || 0, date: toDate(e.date) }))
    .filter((e) => e.date.getTime() <= end.getTime())
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  let drawn = 0;
  let repaid = 0;
  let interestPaid = 0;
  let feePaid = 0;
  let principal = 0;
  let interestAccrued = 0;
  let cursor: Date | null = null;

  const dailyFactor = rate / 100 / 365;

  for (const e of sorted) {
    // Accrue on the balance held since the previous event up to this event.
    if (cursor && principal > 0 && dailyFactor > 0) {
      interestAccrued += principal * dailyFactor * daysBetween(cursor, e.date);
    }
    cursor = e.date;
    if (e.kind === 'DRAWDOWN') { drawn += e.amount; principal += e.amount; }
    else if (e.kind === 'REPAYMENT') { repaid += e.amount; principal = Math.max(0, principal - e.amount); }
    else if (e.kind === 'INTEREST') { interestPaid += e.amount; }
    else if (e.kind === 'FEE') { feePaid += e.amount; }
  }

  // Accrue from the last event to the as-of date.
  if (cursor && principal > 0 && dailyFactor > 0) {
    interestAccrued += principal * dailyFactor * daysBetween(cursor, end);
  }

  const round = (n: number) => Math.round(n * 100) / 100;
  const accrued = round(interestAccrued);
  return {
    drawn: round(drawn),
    repaid: round(repaid),
    interestPaid: round(interestPaid),
    feePaid: round(feePaid),
    outstanding: round(principal),
    interestAccrued: accrued,
    netInterestDue: Math.max(0, round(accrued - interestPaid)),
  };
}

export interface FacilitySummaryInput {
  outstanding: number;
  interestAccrued: number;
  interestPaid: number;
  interestRate: number | null;
}

export interface BorrowingsSummary {
  totalOutstanding: number;
  totalInterestAccrued: number;
  totalInterestPaid: number;
  totalNetInterestDue: number;
  /** Interest-weighted average annual rate across facilities with a balance. */
  weightedAvgRate: number;
  /** Rough interest cost per month at the current balances and rates. */
  monthlyInterestRunRate: number;
}

/** Roll several facilities up into portfolio totals. */
export function summariseBorrowings(rows: FacilitySummaryInput[]): BorrowingsSummary {
  let totalOutstanding = 0;
  let totalInterestAccrued = 0;
  let totalInterestPaid = 0;
  let totalNetInterestDue = 0;
  let weightedRateNumerator = 0;
  let monthly = 0;

  for (const r of rows) {
    totalOutstanding += r.outstanding;
    totalInterestAccrued += r.interestAccrued;
    totalInterestPaid += r.interestPaid;
    totalNetInterestDue += Math.max(0, r.interestAccrued - r.interestPaid);
    if (r.interestRate != null && r.outstanding > 0) {
      weightedRateNumerator += r.outstanding * r.interestRate;
      monthly += (r.outstanding * (r.interestRate / 100)) / 12;
    }
  }

  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    totalOutstanding: round(totalOutstanding),
    totalInterestAccrued: round(totalInterestAccrued),
    totalInterestPaid: round(totalInterestPaid),
    totalNetInterestDue: round(totalNetInterestDue),
    weightedAvgRate: totalOutstanding > 0 ? round(weightedRateNumerator / totalOutstanding) : 0,
    monthlyInterestRunRate: round(monthly),
  };
}
