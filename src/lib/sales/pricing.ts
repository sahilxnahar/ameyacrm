/**
 * Unit pricing, kept pure so it can be tested without a database and works in
 * whole rupees. Batch 7 (sales depth): a unit's price is not one number — it is
 * a base rate on the saleable area, plus floor rise, plus preferential-location
 * and view premiums, less an agreed discount. Doing this by hand in a
 * spreadsheet is how two salespeople quote the same flat differently; computing
 * it here means everyone quotes the same way, and a discount beyond a role's
 * limit is flagged rather than quietly given.
 */

export interface PricingInput {
  /** Saleable area in square feet. */
  areaSqft: number;
  /** Base rate per square foot. */
  baseRatePerSqft: number;
  /** Floor number; floor rise is charged per floor above the base floor. */
  floor: number;
  baseFloor?: number;
  /** Extra per sqft charged per floor of rise. */
  floorRisePerSqft?: number;
  /** Preferential-location charge per sqft (corner, park-facing, etc.). */
  plcPerSqft?: number;
  /** View premium per sqft. */
  viewPremiumPerSqft?: number;
  /** Lump-sum additions — car park, club, infra — not on a per-sqft basis. */
  lumpSums?: number[];
  /** Discount, as an absolute rupee amount. */
  discountAmount?: number;
}

export interface PricingResult {
  baseAmount: number;
  floorRiseAmount: number;
  plcAmount: number;
  viewPremiumAmount: number;
  lumpSumTotal: number;
  /** Everything before discount. */
  grossPrice: number;
  discountAmount: number;
  /** What the buyer pays. */
  netPrice: number;
  /** The discount as a percentage of gross, for the approval check. */
  discountPct: number;
  /** Effective all-in rate per sqft after everything. */
  effectiveRatePerSqft: number;
}

const r0 = (n: number) => Math.round(n);

export function priceUnit(input: PricingInput): PricingResult {
  const area = Math.max(0, input.areaSqft);
  const baseAmount = area * input.baseRatePerSqft;
  const floorsOfRise = Math.max(0, input.floor - (input.baseFloor ?? 0));
  const floorRiseAmount = area * (input.floorRisePerSqft ?? 0) * floorsOfRise;
  const plcAmount = area * (input.plcPerSqft ?? 0);
  const viewPremiumAmount = area * (input.viewPremiumPerSqft ?? 0);
  const lumpSumTotal = (input.lumpSums ?? []).reduce((s, n) => s + n, 0);

  const grossPrice = baseAmount + floorRiseAmount + plcAmount + viewPremiumAmount + lumpSumTotal;
  const discountAmount = Math.min(Math.max(0, input.discountAmount ?? 0), grossPrice);
  const netPrice = grossPrice - discountAmount;

  return {
    baseAmount: r0(baseAmount),
    floorRiseAmount: r0(floorRiseAmount),
    plcAmount: r0(plcAmount),
    viewPremiumAmount: r0(viewPremiumAmount),
    lumpSumTotal: r0(lumpSumTotal),
    grossPrice: r0(grossPrice),
    discountAmount: r0(discountAmount),
    netPrice: r0(netPrice),
    discountPct: grossPrice > 0 ? Math.round((discountAmount / grossPrice) * 10000) / 100 : 0,
    effectiveRatePerSqft: area > 0 ? Math.round(netPrice / area) : 0,
  };
}

/**
 * A discount approval matrix: each role may approve up to a percentage. Returns
 * whether the discount is within the given role's limit, and the lowest role
 * that could approve it — so the UI can route it for sign-off rather than let it
 * through.
 */
export interface ApprovalTier {
  role: string;
  maxDiscountPct: number;
}

export function discountApproval(
  discountPct: number,
  role: string,
  matrix: ApprovalTier[],
): { withinLimit: boolean; roleLimit: number; approverNeeded: string | null } {
  const tier = matrix.find((t) => t.role === role);
  const roleLimit = tier?.maxDiscountPct ?? 0;
  const withinLimit = discountPct <= roleLimit + 1e-9;
  let approverNeeded: string | null = null;
  if (!withinLimit) {
    const sorted = [...matrix].sort((a, b) => a.maxDiscountPct - b.maxDiscountPct);
    approverNeeded = sorted.find((t) => discountPct <= t.maxDiscountPct + 1e-9)?.role ?? null;
  }
  return { withinLimit, roleLimit, approverNeeded };
}
