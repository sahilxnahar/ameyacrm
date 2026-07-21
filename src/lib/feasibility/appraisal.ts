/**
 * Development appraisal, kept pure. Batch 18: every other number in the system
 * describes a project already committed to. This is for deciding whether to
 * commit to the next one — land, construction, finance and sales set against
 * each other to produce profit on cost and a margin, plus a residual land value
 * (what a parcel can be worth given a target return) and a scenario knob for
 * "sale rate down 5%, cost up 10%".
 */

export interface AppraisalInput {
  landCost: number;
  constructionCost: number;
  financeCost: number;
  otherCost: number;
  saleableAreaSqft: number;
  salePricePerSqft: number;
  /** Scenario knobs, as percentages. */
  salePriceDeltaPct?: number;
  costDeltaPct?: number;
}

export interface AppraisalResult {
  totalCost: number;
  saleValue: number;
  profit: number;
  /** Profit as a percentage of total cost — the developer's headline number. */
  profitOnCostPct: number;
  /** Profit as a percentage of sale value. */
  marginPct: number;
}

const r0 = (n: number) => Math.round(n);

export function appraise(input: AppraisalInput): AppraisalResult {
  const costFactor = 1 + (input.costDeltaPct ?? 0) / 100;
  const priceFactor = 1 + (input.salePriceDeltaPct ?? 0) / 100;

  const nonLandCost = (input.constructionCost + input.financeCost + input.otherCost) * costFactor;
  const totalCost = input.landCost + nonLandCost;
  const saleValue = input.saleableAreaSqft * input.salePricePerSqft * priceFactor;
  const profit = saleValue - totalCost;

  return {
    totalCost: r0(totalCost),
    saleValue: r0(saleValue),
    profit: r0(profit),
    profitOnCostPct: totalCost > 0 ? Math.round((profit / totalCost) * 10000) / 100 : 0,
    marginPct: saleValue > 0 ? Math.round((profit / saleValue) * 10000) / 100 : 0,
  };
}

/**
 * Residual land value: the most you could pay for the land and still hit a
 * target return on the *non-land* cost. It is the number that decides what to
 * bid, rather than what to hope for. Sale value, less non-land cost, less the
 * required profit on that cost.
 */
export function residualLandValue(input: Omit<AppraisalInput, 'landCost'>, targetReturnPct: number): number {
  const priceFactor = 1 + (input.salePriceDeltaPct ?? 0) / 100;
  const costFactor = 1 + (input.costDeltaPct ?? 0) / 100;
  const nonLandCost = (input.constructionCost + input.financeCost + input.otherCost) * costFactor;
  const saleValue = input.saleableAreaSqft * input.salePricePerSqft * priceFactor;
  const requiredProfit = nonLandCost * (targetReturnPct / 100);
  return Math.max(0, Math.round(saleValue - nonLandCost - requiredProfit));
}
