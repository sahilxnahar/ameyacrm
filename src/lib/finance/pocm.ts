/**
 * IND-AS 115 Percentage-of-Completion (POCM) revenue recognition (module #51).
 * Revenue for a real-estate project is recognised in proportion to cost incurred
 * against total estimated cost. Pure + unit-tested so the recognised figure is
 * auditable and never drifts from the ledger.
 */
export interface PocmInput {
  costToDate: number;
  totalEstCost: number;
  totalContractVal: number;
  revenueRecognisedSoFar?: number; // sum of prior periods
}
export interface PocmResult {
  pocmPercent: number;      // 0..100, 3dp
  revenueToDate: number;    // cumulative recognised
  revenueThisPeriod: number;
}

export function computePocm(input: PocmInput): PocmResult {
  const { costToDate, totalEstCost, totalContractVal } = input;
  const prior = input.revenueRecognisedSoFar ?? 0;
  if (!(totalEstCost > 0)) return { pocmPercent: 0, revenueToDate: 0, revenueThisPeriod: 0 };
  const ratio = Math.min(1, Math.max(0, costToDate / totalEstCost)); // clamp 0..1 (no over-recognition)
  const pocmPercent = Math.round(ratio * 100 * 1000) / 1000;
  const revenueToDate = Math.round(ratio * totalContractVal * 100) / 100;
  const revenueThisPeriod = Math.round(Math.max(0, revenueToDate - prior) * 100) / 100;
  return { pocmPercent, revenueToDate, revenueThisPeriod };
}
