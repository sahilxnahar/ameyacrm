// Pure, testable TDS calculation + section-suggestion logic (v15.52).
import { TDS_SECTIONS, tdsSection, type TdsSection } from '@/config/tds-sections';

export interface TdsResult {
  section: string | null;
  rate: number;          // % actually applied
  amount: number;        // TDS to deduct (rounded to rupee)
  net: number;           // amount payable after TDS
  reason: string;        // human explanation
}

const r0 = (n: number) => Math.round(n);

/**
 * Work out the TDS on a payment/invoice for a given section.
 * - No PAN → higher s.206AA rate.
 * - At or below the section's per-transaction threshold → no deduction.
 */
export function computeTds(opts: {
  sectionCode: string | null | undefined;
  base: number;
  hasPan?: boolean;      // deductee has a valid PAN (default true)
}): TdsResult {
  const base = Math.max(0, Number(opts.base) || 0);
  const sec = tdsSection(opts.sectionCode);
  if (!sec) return { section: null, rate: 0, amount: 0, net: base, reason: 'No TDS section mapped.' };

  if (sec.threshold > 0 && base <= sec.threshold) {
    return { section: sec.code, rate: 0, amount: 0, net: base, reason: `Below the ₹${sec.threshold.toLocaleString('en-IN')} threshold for ${sec.code} — no TDS.` };
  }
  const hasPan = opts.hasPan !== false;
  const rate = hasPan ? sec.rate : sec.rateNoPan;
  const amount = r0((base * rate) / 100);
  return {
    section: sec.code,
    rate,
    amount,
    net: base - amount,
    reason: hasPan
      ? `${sec.code} at ${rate}% on ₹${r0(base).toLocaleString('en-IN')}.`
      : `No PAN — s.206AA higher rate ${rate}% applied.`,
  };
}

/**
 * Suggest a TDS section from a vendor's saved default, else from the expense
 * category / narration keywords. Returns null when nothing matches.
 */
export function suggestTdsSection(opts: {
  vendorDefault?: string | null;
  accountCode?: string | null;
  text?: string | null;
}): string | null {
  if (opts.vendorDefault && tdsSection(opts.vendorDefault)) return opts.vendorDefault;
  const hay = `${opts.accountCode ?? ''} ${opts.text ?? ''}`.toLowerCase();
  if (!hay.trim()) return null;
  let best: { code: string; score: number } | null = null;
  for (const s of TDS_SECTIONS) {
    let score = 0;
    for (const kw of s.keywords.split(/\s+/)) {
      if (kw && hay.includes(kw)) score += kw.length; // longer keyword = stronger signal
    }
    if (score > 0 && (!best || score > best.score)) best = { code: s.code, score };
  }
  return best?.code ?? null;
}

export type { TdsSection };
