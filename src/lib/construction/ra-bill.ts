// Pure, testable RA-bill maths (v15.53). Reuses the TDS engine for the tax line.
import { computeTds } from '@/lib/tax/tds';

export interface RaBillComputation {
  gross: number;
  cessAmount: number;       // 1% BOCW labour cess (statutory)
  retentionAmount: number;  // held back from the contractor
  tdsSection: string | null;
  tdsRate: number;
  tdsAmount: number;
  deductions: number;
  netPayable: number;       // what the contractor actually receives now
}

const r0 = (n: number) => Math.round(n);

/**
 * Certified gross, less: ad-hoc deductions, 1% BOCW cess, retention, and TDS.
 * Cess and TDS are computed on the certified gross value.
 */
export function computeRaBill(opts: {
  grossValue: number;
  deductions?: number;
  cessPercent?: number;      // default 1% (BOCW)
  retentionPercent?: number; // default 5%
  tdsSection?: string | null;
  hasPan?: boolean;
}): RaBillComputation {
  const gross = Math.max(0, Number(opts.grossValue) || 0);
  const deductions = Math.max(0, Number(opts.deductions) || 0);
  const cessPercent = opts.cessPercent ?? 1;
  const retentionPercent = opts.retentionPercent ?? 5;

  const cessAmount = r0((gross * cessPercent) / 100);
  const retentionAmount = r0((gross * retentionPercent) / 100);
  const tds = computeTds({ sectionCode: opts.tdsSection ?? '194C', base: gross, hasPan: opts.hasPan });
  const netPayable = Math.max(0, r0(gross - deductions - cessAmount - retentionAmount - tds.amount));

  return {
    gross: r0(gross),
    cessAmount,
    retentionAmount,
    tdsSection: tds.section,
    tdsRate: tds.rate,
    tdsAmount: tds.amount,
    deductions: r0(deductions),
    netPayable,
  };
}
