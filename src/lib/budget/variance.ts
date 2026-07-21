import { VARIANCE_THRESHOLD_ABS, VARIANCE_THRESHOLD_PCT } from '@/config/cost-codes';

/**
 * Budget arithmetic, kept pure so it can be tested without a database.
 *
 * The three actuals are deliberately separate all the way through. Collapsing
 * them into one "spent" figure is the mistake that makes budget reports
 * comforting and useless: by the time a cost is *paid* it was decided months
 * ago, and the only number you could still have acted on was what had been
 * *committed*.
 */

export interface HeadFigures {
  costCode: string;
  name: string;
  budget: number;
  /** Orders placed but not yet billed. */
  committed: number;
  /** Bills received, paid or not. */
  incurred: number;
  /** Money actually gone. */
  paid: number;
}

export interface HeadResult extends HeadFigures {
  /** Committed plus incurred: everything the project is on the hook for. */
  exposure: number;
  remaining: number;
  usedPct: number;
  overBudget: boolean;
  /** Positive means over. */
  variance: number;
  variancePct: number;
  needsExplanation: boolean;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Exposure is committed *plus* incurred, not the larger of the two.
 *
 * An order for ₹10 lakh that has been billed ₹4 lakh so far leaves ₹6 lakh
 * still to come — so the caller is expected to reduce `committed` as bills
 * arrive against it. Adding the raw numbers would double-count; that is handled
 * where the figures are gathered, and asserted in the tests.
 */
export function analyseHead(f: HeadFigures): HeadResult {
  const exposure = r2(f.committed + f.incurred);
  const remaining = r2(f.budget - exposure);
  const variance = r2(exposure - f.budget);
  const usedPct = f.budget > 0 ? r2((exposure / f.budget) * 100) : exposure > 0 ? 100 : 0;
  const variancePct = f.budget > 0 ? r2((variance / f.budget) * 100) : 0;

  return {
    ...f,
    exposure,
    remaining,
    usedPct,
    overBudget: variance > 0,
    variance,
    variancePct,
    needsExplanation:
      Math.abs(variance) >= VARIANCE_THRESHOLD_ABS &&
      Math.abs(variancePct) >= VARIANCE_THRESHOLD_PCT,
  };
}

export interface CommitmentVerdict {
  allowed: boolean;
  blocked: boolean;
  message: string | null;
  remainingAfter: number;
}

/**
 * May this order be placed against this head?
 *
 * Warns rather than blocks by default. A hard block on a construction site
 * produces one of two outcomes, both worse than an overspend: the order is
 * split into pieces small enough to slip through, or it is booked to whichever
 * head still has room. A visible warning that somebody must acknowledge keeps
 * the number honest, which is the actual objective.
 */
export function checkCommitment(
  head: HeadResult,
  orderAmount: number,
  opts: { hardBlock?: boolean } = {},
): CommitmentVerdict {
  const after = r2(head.remaining - orderAmount);
  if (after >= 0) {
    return { allowed: true, blocked: false, message: null, remainingAfter: after };
  }

  const over = Math.abs(after);
  const msg =
    head.budget <= 0
      ? `"${head.name}" has no budget set, so there is nothing to check this order against.`
      : `This order takes "${head.name}" over budget by ₹${over.toLocaleString('en-IN')}. ` +
        `Budget ₹${head.budget.toLocaleString('en-IN')}, already committed and incurred ₹${head.exposure.toLocaleString('en-IN')}.`;

  return {
    allowed: !opts.hardBlock,
    blocked: Boolean(opts.hardBlock),
    message: msg,
    remainingAfter: after,
  };
}

/**
 * What the head will finally cost.
 *
 * Two estimates, because they disagree in a useful way. `atCompletion` trusts
 * the budget for the work not yet ordered; `atCurrentRate` assumes the overspend
 * so far continues. When a head is 40% complete and 60% spent, the second is
 * usually the honest one.
 */
export function forecast(head: HeadResult, percentComplete: number): {
  atCompletion: number;
  atCurrentRate: number | null;
  costToComplete: number;
} {
  const pct = Math.min(Math.max(percentComplete, 0), 100);
  const atCompletion = r2(Math.max(head.exposure, head.budget));
  const atCurrentRate = pct > 0 ? r2((head.exposure / pct) * 100) : null;
  const costToComplete = r2(Math.max(atCompletion - head.exposure, 0));
  return { atCompletion, atCurrentRate, costToComplete };
}

export function rollUp(heads: HeadResult[]): {
  budget: number; committed: number; incurred: number; paid: number;
  exposure: number; remaining: number; usedPct: number; overCount: number;
} {
  const sum = (f: (h: HeadResult) => number) => r2(heads.reduce((a, h) => a + f(h), 0));
  const budget = sum((h) => h.budget);
  const exposure = sum((h) => h.exposure);
  return {
    budget,
    committed: sum((h) => h.committed),
    incurred: sum((h) => h.incurred),
    paid: sum((h) => h.paid),
    exposure,
    remaining: r2(budget - exposure),
    usedPct: budget > 0 ? r2((exposure / budget) * 100) : 0,
    overCount: heads.filter((h) => h.overBudget).length,
  };
}
