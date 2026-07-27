// Client-safe catalogue of Indian TDS sections and their standard rates (v15.52).
// Statutory reference data kept in code so a rate change ships with a release.
// Rates are the common resident rates; where PAN is missing, s.206AA applies a
// higher rate (usually 20%). Thresholds are the per-transaction / annual limits
// below which no TDS is deducted. Always have your CA confirm for edge cases.

export interface TdsSection {
  code: string;         // e.g. '194C'
  label: string;        // plain description
  rate: number;         // standard resident rate (%)
  rateNoPan: number;    // rate when the deductee has no PAN (s.206AA)
  threshold: number;    // no TDS at or below this amount (single txn, ₹); 0 = always
  annualThreshold?: number; // annual aggregate limit, where relevant (₹)
  keywords: string;     // for search / auto-mapping from expense category
}

export const TDS_SECTIONS: TdsSection[] = [
  { code: '194C', label: 'Payment to contractors / sub-contractors', rate: 2, rateNoPan: 20, threshold: 30000, annualThreshold: 100000, keywords: 'contractor works labour civil construction fabrication job work 5300 5400' },
  { code: '194C-IND', label: 'Payment to contractor — individual / HUF', rate: 1, rateNoPan: 20, threshold: 30000, annualThreshold: 100000, keywords: 'contractor individual huf proprietor' },
  { code: '194J', label: 'Professional / technical fees', rate: 10, rateNoPan: 20, threshold: 30000, keywords: 'professional technical consultant architect legal audit fees design fee 5600 5700' },
  { code: '194J-TECH', label: 'Technical services / call-centre', rate: 2, rateNoPan: 20, threshold: 30000, keywords: 'technical service call centre royalty software' },
  { code: '194I-LAND', label: 'Rent — land / building / furniture', rate: 10, rateNoPan: 20, threshold: 0, annualThreshold: 240000, keywords: 'rent office building land furniture premises lease 6100' },
  { code: '194I-PM', label: 'Rent — plant & machinery', rate: 2, rateNoPan: 20, threshold: 0, annualThreshold: 240000, keywords: 'rent plant machinery equipment hire' },
  { code: '194H', label: 'Commission / brokerage', rate: 5, rateNoPan: 20, threshold: 15000, keywords: 'commission brokerage channel partner referral 6300' },
  { code: '194A', label: 'Interest (other than securities)', rate: 10, rateNoPan: 20, threshold: 5000, keywords: 'interest loan unsecured deposit' },
  { code: '194Q', label: 'Purchase of goods (> ₹50L / year)', rate: 0.1, rateNoPan: 5, threshold: 0, annualThreshold: 5000000, keywords: 'goods purchase material supply 5300' },
  { code: '194IA', label: 'Purchase of immovable property (≥ ₹50L)', rate: 1, rateNoPan: 20, threshold: 5000000, keywords: 'property land immovable purchase sale deed' },
  { code: '194IB', label: 'Rent by individual/HUF (> ₹50k/month)', rate: 5, rateNoPan: 20, threshold: 50000, keywords: 'rent individual huf residential' },
  { code: '192', label: 'Salary', rate: 0, rateNoPan: 0, threshold: 0, keywords: 'salary payroll employee' },
  { code: '194', label: 'Dividend', rate: 10, rateNoPan: 20, threshold: 5000, keywords: 'dividend shareholder' },
  { code: '195', label: 'Payment to non-resident', rate: 20, rateNoPan: 20, threshold: 0, keywords: 'non resident nri foreign remittance import' },
];

export const TDS_SECTION_CODES = TDS_SECTIONS.map((s) => s.code);
const BY_CODE = new Map(TDS_SECTIONS.map((s) => [s.code, s]));
export function tdsSection(code: string | null | undefined): TdsSection | undefined {
  return code ? BY_CODE.get(code) : undefined;
}
