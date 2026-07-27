/**
 * Capital-gains exemption calculator, Sections 54 & 54F (module #55). A
 * front-office tool a sales exec runs for a prospect to show the tax saved by
 * reinvesting sale proceeds into an Ameya Heights home. Pure + unit-tested.
 *
 * S.54  — LTCG on a residential house reinvested in another house: exemption =
 *          min(capital gain, amount reinvested).
 * S.54F — LTCG on any OTHER long-term asset reinvested in a house: exemption =
 *          gain × (amount reinvested / net sale consideration), capped at the gain.
 * LTCG on immovable property is taxed at 20% (with indexation) — the tax saved is
 * the exempt gain × 20%.
 */
export const LTCG_RATE = 0.20;

export interface CapitalGainInput {
  saleValue: number;      // net sale consideration
  indexedCost: number;    // indexed cost of acquisition/improvement
  section: '54' | '54F';
  reinvestAmount: number; // amount put into the new house
}
export interface CapitalGainResult {
  gain: number;
  exemptGain: number;
  taxableGain: number;
  taxSaved: number;
  taxPayable: number;
}

export function computeCapitalGain(input: CapitalGainInput): CapitalGainResult {
  const saleValue = Math.max(0, input.saleValue);
  const gain = Math.max(0, saleValue - Math.max(0, input.indexedCost));
  const reinvest = Math.max(0, input.reinvestAmount);

  let exemptGain: number;
  if (input.section === '54') {
    exemptGain = Math.min(gain, reinvest);
  } else {
    // 54F is proportionate to how much of the sale proceeds are reinvested.
    const proportion = saleValue > 0 ? Math.min(1, reinvest / saleValue) : 0;
    exemptGain = Math.min(gain, gain * proportion);
  }
  exemptGain = Math.round(exemptGain * 100) / 100;
  const taxableGain = Math.round(Math.max(0, gain - exemptGain) * 100) / 100;
  const taxSaved = Math.round(exemptGain * LTCG_RATE * 100) / 100;
  const taxPayable = Math.round(taxableGain * LTCG_RATE * 100) / 100;
  return { gain: Math.round(gain * 100) / 100, exemptGain, taxableGain, taxSaved, taxPayable };
}
