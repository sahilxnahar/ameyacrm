/**
 * Indian real-estate tax arithmetic for a payment demand — GST and TDS u/s
 * 194-IA — kept pure so it can be tested without a database.
 *
 * GST on an under-construction residential unit is charged on each demand at the
 * applicable rate (5% without input-tax credit for non-affordable homes, 1% for
 * affordable; 12% for commercial). The rate is a setting, defaulted to 5%.
 *
 * TDS u/s 194-IA: when the total sale consideration is ₹50 lakh or more, the
 * BUYER must deduct 1% of each payment to a resident seller and deposit it with
 * the government (Form 26QB). It is deducted on the base amount, not on the GST.
 * So the money the developer actually receives is (base + GST − TDS), and the
 * buyer separately remits the TDS. The letter spells all of this out.
 */
export interface DemandTax {
  base: number;
  gstPct: number;
  gst: number;
  gross: number;
  tdsApplicable: boolean;
  tdsPct: number;
  tds: number;
  netToDeveloper: number;
  gstNote: string;
  tdsNote: string;
}

export interface TaxOptions {
  gstPct?: number;        // default 5
  tdsPct?: number;        // default 1 (194-IA)
  tdsThreshold?: number;  // default 50,00,000
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function computeDemandTax(base: number, agreementValue: number | null, opts: TaxOptions = {}): DemandTax {
  const gstPct = opts.gstPct ?? 5;
  const tdsPct = opts.tdsPct ?? 1;
  const threshold = opts.tdsThreshold ?? 5000000;

  const safeBase = Math.max(0, r2(base));
  const gst = r2(safeBase * (gstPct / 100));
  const gross = r2(safeBase + gst);

  // 194-IA applies on total consideration ≥ threshold. Where the agreement value
  // is unknown we fall back to the demand amount, so a large one-shot demand is
  // still handled correctly.
  const consideration = agreementValue && agreementValue > 0 ? agreementValue : safeBase;
  const tdsApplicable = consideration >= threshold;
  const tds = tdsApplicable ? r2(safeBase * (tdsPct / 100)) : 0;
  const netToDeveloper = r2(gross - tds);

  return {
    base: safeBase, gstPct, gst, gross,
    tdsApplicable, tdsPct, tds, netToDeveloper,
    gstNote: `GST @ ${gstPct}% on the demand value (under-construction; no input-tax credit).`,
    tdsNote: tdsApplicable
      ? `As the total consideration is Rs. ${consideration.toLocaleString('en-IN')} (at or above Rs. 50,00,000), you must deduct TDS @ ${tdsPct}% (Sec. 194-IA) = Rs. ${tds.toLocaleString('en-IN')} and deposit it via Form 26QB. Pay the developer the net amount shown.`
      : 'TDS u/s 194-IA does not apply (total consideration is below Rs. 50,00,000).',
  };
}
