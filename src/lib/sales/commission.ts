/**
 * Broker (channel partner) commission, kept pure and in whole rupees. Batch 7:
 * partner screens exist; the calculation did not. A commission is a slab rate on
 * the booking value, often paid across milestones, with TDS deducted at source —
 * and getting any of those three wrong is a dispute with the person who brings
 * you buyers. This computes all three, the same way every time.
 */

export interface CommissionSlab {
  /** Inclusive lower bound of booking value this rate applies from. */
  fromValue: number;
  /** Rate percent for bookings at or above `fromValue` (until the next slab). */
  ratePct: number;
}

/** Pick the rate for a booking value from a slab table (highest matching floor). */
export function rateForValue(bookingValue: number, slabs: CommissionSlab[]): number {
  const applicable = slabs
    .filter((s) => bookingValue >= s.fromValue)
    .sort((a, b) => b.fromValue - a.fromValue)[0];
  return applicable?.ratePct ?? 0;
}

export interface CommissionInput {
  bookingValue: number;
  slabs: CommissionSlab[];
  /** TDS rate percent to deduct (e.g. 5 for 5% under 194H). */
  tdsRatePct?: number;
  /** Milestone splits as percentages of the gross commission; should sum to 100.
   *  Defaults to a single 100% milestone. */
  milestonesPct?: number[];
}

export interface CommissionMilestone {
  index: number;
  sharePct: number;
  gross: number;
  tds: number;
  net: number;
}

export interface CommissionResult {
  ratePct: number;
  grossCommission: number;
  totalTds: number;
  netPayable: number;
  milestones: CommissionMilestone[];
}

const r0 = (n: number) => Math.round(n);

export function computeCommission(input: CommissionInput): CommissionResult {
  const ratePct = rateForValue(input.bookingValue, input.slabs);
  const grossCommission = input.bookingValue * (ratePct / 100);
  const tdsRate = input.tdsRatePct ?? 0;

  const splits = input.milestonesPct && input.milestonesPct.length > 0 ? input.milestonesPct : [100];
  const milestones: CommissionMilestone[] = splits.map((sharePct, index) => {
    const gross = grossCommission * (sharePct / 100);
    const tds = gross * (tdsRate / 100);
    return { index, sharePct, gross: r0(gross), tds: r0(tds), net: r0(gross - tds) };
  });

  const totalTds = milestones.reduce((s, m) => s + m.tds, 0);
  const grossRounded = milestones.reduce((s, m) => s + m.gross, 0);
  return {
    ratePct,
    grossCommission: grossRounded,
    totalTds,
    netPayable: grossRounded - totalTds,
    milestones,
  };
}
