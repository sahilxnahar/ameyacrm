/**
 * The data dictionary — what each field on the core records means, where it
 * comes from, and which fields the rest of the system depends on.
 *
 * It ends the "which of these two figures is right" conversation, and it is the
 * single source the data-quality scorer reads its `required` and identity fields
 * from, so the documentation and the score can never drift apart.
 *
 * Every field key here is a real column on the model named in `table`. Inventing
 * a field that does not exist is the recurring bug this codebase guards against;
 * these were checked against prisma/schema.prisma.
 */

export interface FieldDoc {
  key: string;
  label: string;
  description: string;
  /** Counts toward the completeness score. */
  required?: boolean;
  /** Used by duplicate detection to identify the same real-world entity. */
  identity?: boolean;
}

export interface EntityDoc {
  key: 'lead' | 'vendor' | 'customer';
  label: string;
  table: string;
  description: string;
  /** Where the records come from, in plain language. */
  source: string;
  fields: FieldDoc[];
}

export const DATA_DICTIONARY: EntityDoc[] = [
  {
    key: 'lead',
    label: 'Leads',
    table: 'Lead',
    description: 'A prospective buyer, from first enquiry to booked or lost.',
    source: 'Website forms, walk-ins, referrals, portals and channel partners.',
    fields: [
      { key: 'reference', label: 'Reference', description: 'System code, e.g. LEAD-2044. Always present.' },
      { key: 'name', label: 'Name', description: 'The prospect’s name.', required: true, identity: true },
      { key: 'phone', label: 'Phone', description: 'Primary contact number. The field most calls and WhatsApp match on.', required: true, identity: true },
      { key: 'email', label: 'Email', description: 'Used for sequences and statements.', identity: true },
      { key: 'ownerId', label: 'Owner', description: 'The salesperson responsible. An unowned lead is nobody’s job.', required: true },
      { key: 'requirement', label: 'Requirement', description: 'What they are looking for — configuration, budget, area.' },
      { key: 'projectId', label: 'Project', description: 'Which project the interest is against.' },
      { key: 'consentAt', label: 'Consent', description: 'DPDP: when this person agreed to be contacted. Absence limits outreach.' },
      { key: 'channelPartnerId', label: 'Channel partner', description: 'The broker who introduced the lead, if any.' },
    ],
  },
  {
    key: 'vendor',
    label: 'Vendors',
    table: 'Vendor',
    description: 'A supplier, contractor or authority the company pays.',
    source: 'Created when raising the first PO, bill or payment.',
    fields: [
      { key: 'name', label: 'Name', description: 'Trading name. Four spellings of one vendor is the classic mess.', required: true, identity: true },
      { key: 'phone', label: 'Phone', description: 'Primary contact.', required: true, identity: true },
      { key: 'email', label: 'Email', description: 'For POs and remittance advice.', identity: true },
      { key: 'gstin', label: 'GSTIN', description: '15-character GST number. Needed for input credit and a compliant bill.', required: true, identity: true },
      { key: 'pan', label: 'PAN', description: 'Needed for TDS and Form 16A.', identity: true },
      { key: 'bankAccountNumber', label: 'Bank a/c', description: 'Where payments go. Blank means they cannot be paid by transfer.', required: true },
      { key: 'bankIfsc', label: 'IFSC', description: '11-character branch code. A wrong one bounces the payment.', required: true },
      { key: 'address', label: 'Address', description: 'Registered address for the bill.' },
    ],
  },
  {
    key: 'customer',
    label: 'Buyers',
    table: 'Customer',
    description: 'A buyer with a booking and portal access.',
    source: 'Created at booking; owns the buyer-portal login.',
    fields: [
      { key: 'name', label: 'Name', description: 'The buyer’s name as it will appear on the agreement.', required: true, identity: true },
      { key: 'phone', label: 'Phone', description: 'Primary contact for demands and updates.', required: true, identity: true },
      { key: 'email', label: 'Email', description: 'Portal login and statements.', identity: true },
      { key: 'bookingId', label: 'Booking', description: 'The unit booking this buyer belongs to. Without it, dues cannot be shown.', required: true },
      { key: 'projectId', label: 'Project', description: 'Which project the buyer is in.' },
    ],
  },
];

export function requiredFields(entity: EntityDoc): string[] {
  return entity.fields.filter((f) => f.required).map((f) => f.key);
}

export function identityFields(entity: EntityDoc): string[] {
  return entity.fields.filter((f) => f.identity).map((f) => f.key);
}
