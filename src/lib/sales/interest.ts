/**
 * Interest on delayed buyer payments, kept pure and timezone-safe. Batch 7: a
 * demand falls due, the money comes late, and interest is charged on the days it
 * was late — calculated the same way every time and waivable only with approval,
 * rather than negotiated afresh in every awkward phone call. `now`/dates are
 * always passed in; no clock is read here.
 */

const DAY = 86_400_000;

/** Whole days `to` is after `from`, counted at UTC midnight so a few hours never
 *  flip the count. Never negative. */
export function daysLate(dueDate: Date, paidDate: Date): number {
  const a = Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate());
  const b = Date.UTC(paidDate.getUTCFullYear(), paidDate.getUTCMonth(), paidDate.getUTCDate());
  return Math.max(0, Math.round((b - a) / DAY));
}

export interface InterestInput {
  /** The overdue principal in rupees. */
  amount: number;
  dueDate: Date;
  /** When it was paid (or `now` if still outstanding). */
  asOf: Date;
  /** Annual rate percent (e.g. 18 for 18% p.a.). */
  annualRatePct: number;
  /** Days of grace before interest starts. */
  graceDays?: number;
}

export interface InterestResult {
  daysLate: number;
  chargeableDays: number;
  /** Simple interest on the chargeable days. */
  interest: number;
}

/**
 * Simple interest for the days beyond grace: amount × rate/100 × days/365.
 * Simple, not compound, because that is what a demand letter defends and what a
 * buyer will accept without a fight.
 */
export function delayInterest(input: InterestInput): InterestResult {
  const late = daysLate(input.dueDate, input.asOf);
  const chargeable = Math.max(0, late - (input.graceDays ?? 0));
  const interest = input.amount * (input.annualRatePct / 100) * (chargeable / 365);
  return { daysLate: late, chargeableDays: chargeable, interest: Math.round(interest) };
}
