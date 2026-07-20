/**
 * Statutory and banking details for Ameya Heights LLP.
 *
 * These are the defaults. An admin can override every field at
 * Admin → Company details, which stores them under the `company.details`
 * setting; the values below are what a fresh database starts with.
 *
 * Used on invoices, payment requests, signature requests and letters, so that
 * the same numbers appear everywhere and are changed in exactly one place.
 */
export interface CompanyDetails {
  legalName: string;
  gstin: string;
  gstState: string;
  pan: string;
  cin: string;
  registeredAddress: string;
  siteName: string;
  siteAddress: string;
  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
  bankIfsc: string;
  bankBranch: string;
  upiId: string;
  phone: string;
  email: string;
  website: string;
}

export const COMPANY_DEFAULTS: CompanyDetails = {
  legalName: 'Ameya Heights LLP',
  gstin: '29AC0FA6794K1ZG',
  gstState: 'Karnataka (29)',
  pan: '',
  cin: '',
  registeredAddress: 'Heeraa Mansion, 20/18 General Muthiah Street, Sowcarpet, Chennai - 600001',
  siteName: 'Ameya Four94',
  siteAddress: '#494, 15th Main Road, 3rd Stage, 1st Block, Basaveshwaranagar, Bangalore - 560079',
  bankName: 'Kotak Mahindra Bank',
  bankAccountName: 'Ameya Heights LLP',
  bankAccountNumber: '9390000000',
  bankIfsc: 'KKBK00008556',
  bankBranch: 'NSC Bose Road Branch, Chennai',
  upiId: '',
  phone: '',
  email: 'crm@ameyaheights.com',
  website: 'www.ameyaheights.com',
};

/** Plain-text block used in emails and on the public payment page. */
export function bankBlock(c: CompanyDetails): string {
  return [
    `Account name: ${c.bankAccountName}`,
    `Bank: ${c.bankName}`,
    `A/c no: ${c.bankAccountNumber}`,
    `IFSC: ${c.bankIfsc}`,
    c.bankBranch ? `Branch: ${c.bankBranch}` : '',
    c.upiId ? `UPI: ${c.upiId}` : '',
  ].filter(Boolean).join('\n');
}
