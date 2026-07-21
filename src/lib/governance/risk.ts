/**
 * Risk scoring, kept pure. Batch 22: a risk register is only useful if the risks
 * sort by how much they matter, so a board looks at the right five. Likelihood ×
 * impact on a 1–4 scale gives a 1–16 score and a band, which is what a heat map
 * colours by.
 */

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

const VALUE: Record<RiskLevel, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

export type RiskBand = 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE';

export interface RiskScore {
  score: number; // 1–16
  band: RiskBand;
}

export function riskScore(likelihood: RiskLevel, impact: RiskLevel): RiskScore {
  const score = VALUE[likelihood] * VALUE[impact];
  let band: RiskBand;
  if (score >= 12) band = 'SEVERE';
  else if (score >= 6) band = 'HIGH';
  else if (score >= 3) band = 'MODERATE';
  else band = 'LOW';
  return { score, band };
}
