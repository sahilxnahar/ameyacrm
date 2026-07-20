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
  gstin: '29ACOFA6794K1ZG',
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

/**
 * Bank details laid out the way an accounts department expects to receive
 * them — aligned labels, in the order a person fills in a transfer form.
 * Used in emails, on the public payment page and on invoices.
 */
export function bankBlock(c: CompanyDetails): string {
  const rows: Array<[string, string]> = [
    ['Account Name', c.bankAccountName],
    ['Bank', c.bankName],
    ['Account No.', c.bankAccountNumber],
    ['IFSC Code', c.bankIfsc],
    ['Branch', c.bankBranch],
    ['GSTIN', c.gstin],
  ];
  if (c.upiId) rows.push(['UPI ID', c.upiId]);
  const pad = Math.max(...rows.map(([k]) => k.length));
  return rows
    .filter(([, v]) => Boolean(v))
    .map(([k, v]) => `${k.padEnd(pad, ' ')} : ${v}`)
    .join('\n');
}

/** Same details as label/value pairs, for tables and PDFs. */
export function bankRows(c: CompanyDetails): Array<{ label: string; value: string }> {
  return [
    { label: 'Account Name', value: c.bankAccountName },
    { label: 'Bank', value: c.bankName },
    { label: 'Account No.', value: c.bankAccountNumber },
    { label: 'IFSC Code', value: c.bankIfsc },
    { label: 'Branch', value: c.bankBranch },
    { label: 'UPI ID', value: c.upiId },
  ].filter((r) => Boolean(r.value));
}
