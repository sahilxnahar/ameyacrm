/**
 * FAR / FSI deviation maths (module #56). Pure + unit-tested so the OC-risk
 * verdict is auditable. Karnataka building bye-laws tolerate a small deviation
 * (commonly ~5%); beyond that the Occupancy Certificate is at risk and the
 * excess may attract regularisation/penalty.
 */
export const OC_DEVIATION_TOLERANCE_PCT = 5;

export function deviationPct(sanctionedFar: number, builtFar: number): number {
  if (!(sanctionedFar > 0)) return 0;
  return Math.round(((builtFar - sanctionedFar) / sanctionedFar) * 100 * 1000) / 1000;
}

export type OcRisk = 'OK' | 'WATCH' | 'AT_RISK';

/** OK below tolerance, WATCH as it nears the sanctioned limit, AT_RISK once over. */
export function ocRisk(sanctionedFar: number, builtFar: number, tolerance = OC_DEVIATION_TOLERANCE_PCT): OcRisk {
  const dev = deviationPct(sanctionedFar, builtFar);
  if (dev > tolerance) return 'AT_RISK';
  if (dev >= 0 || builtFar / (sanctionedFar || 1) >= 0.95) return 'WATCH';
  return 'OK';
}
