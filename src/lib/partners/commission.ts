// Channel-partner commission maths (v15.13). Client-safe, pure, testable.
import { formatCurrency } from '@/lib/utils/format';

export type CommissionBasis = 'PERCENT_OF_SALE' | 'MONTHS_OF_RENT' | 'FLAT_FEE';

export interface CommissionConfig {
  basis: CommissionBasis;
  pct?: number | null;    // percent of sale value
  months?: number | null; // number of months' rent
  flat?: number | null;   // flat fee in rupees
}

export interface CommissionInputs {
  saleValue?: number;   // for PERCENT_OF_SALE
  monthlyRent?: number; // for MONTHS_OF_RENT
}

const r2 = (x: number) => Math.round(x * 100) / 100;

/** The commission payable for a deal, given the partner's basis and the deal figures. */
export function commissionAmount(cfg: CommissionConfig, inputs: CommissionInputs): number {
  switch (cfg.basis) {
    case 'PERCENT_OF_SALE':
      return r2(((inputs.saleValue ?? 0) * (Number(cfg.pct) || 0)) / 100);
    case 'MONTHS_OF_RENT':
      return r2((inputs.monthlyRent ?? 0) * (Number(cfg.months) || 0));
    case 'FLAT_FEE':
      return r2(Number(cfg.flat) || 0);
    default:
      return 0;
  }
}

/** A short human label for how a partner is paid. */
export function commissionLabel(
  cfg: CommissionConfig,
  money: (n: number) => string = formatCurrency,
): string {
  if (cfg.basis === 'MONTHS_OF_RENT') return cfg.months ? `${cfg.months} mo rent + GST` : 'Months of rent';
  if (cfg.basis === 'FLAT_FEE') return cfg.flat ? `${money(Number(cfg.flat))} flat` : 'Flat fee';
  return `${Number(cfg.pct) || 0}%`;
}
