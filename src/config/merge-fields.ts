/**
 * The merge fields a template may use, and realistic sample values so a
 * preview looks like a real message rather than a row of braces.
 *
 * Grouped by the record a template is sent "about". Only fields the CRM can
 * actually fill are listed — an unfillable placeholder is worse than none,
 * because it ships to a buyer as a literal {{brace}}.
 */
export interface MergeField {
  token: string;
  label: string;
  sample: string;
  group: string;
}

export const MERGE_FIELDS: MergeField[] = [
  { token: 'buyer.name', label: 'Buyer name', sample: 'Rajesh Kumar', group: 'Buyer' },
  { token: 'buyer.firstName', label: 'Buyer first name', sample: 'Rajesh', group: 'Buyer' },
  { token: 'buyer.phone', label: 'Buyer phone', sample: '+91 98450 12345', group: 'Buyer' },
  { token: 'buyer.email', label: 'Buyer email', sample: 'rajesh@example.com', group: 'Buyer' },

  { token: 'unit.code', label: 'Unit number', sample: 'A-1204', group: 'Unit' },
  { token: 'unit.typology', label: 'Typology', sample: '3BHK', group: 'Unit' },
  { token: 'unit.tower', label: 'Tower', sample: 'A', group: 'Unit' },
  { token: 'unit.area', label: 'Area (sqft)', sample: '1,850', group: 'Unit' },

  { token: 'booking.number', label: 'Booking number', sample: 'BK-1042', group: 'Booking' },
  { token: 'booking.value', label: 'Agreement value', sample: '1,25,00,000', group: 'Booking' },
  { token: 'booking.date', label: 'Booking date', sample: '12 Jun 2026', group: 'Booking' },

  { token: 'payment.amount', label: 'Amount', sample: '3,50,000', group: 'Payment' },
  { token: 'payment.dueDate', label: 'Due date', sample: '30 Jul 2026', group: 'Payment' },
  { token: 'payment.milestone', label: 'Milestone', sample: 'On completion of 3rd slab', group: 'Payment' },
  { token: 'payment.balance', label: 'Balance outstanding', sample: '18,75,000', group: 'Payment' },
  { token: 'payment.utr', label: 'UTR / reference', sample: 'KKBKN52026010500123456', group: 'Payment' },
  { token: 'payment.receivedOn', label: 'Received on', sample: '05 Jul 2026', group: 'Payment' },

  { token: 'invoice.number', label: 'Invoice number', sample: 'INV-2026-041', group: 'Invoice' },
  { token: 'invoice.total', label: 'Invoice total', sample: '4,72,000', group: 'Invoice' },
  { token: 'invoice.dueDate', label: 'Invoice due date', sample: '15 Aug 2026', group: 'Invoice' },

  { token: 'project.name', label: 'Project name', sample: 'Four94', group: 'Project' },
  { token: 'project.address', label: 'Site address', sample: 'No. 494, 1st Main Road, Bangalore', group: 'Project' },

  { token: 'company.name', label: 'Company name', sample: 'Ameya Heights LLP', group: 'Company' },
  { token: 'company.phone', label: 'Company phone', sample: '+91 98450 00000', group: 'Company' },
  { token: 'company.email', label: 'Company email', sample: 'hi@ameyaheights.com', group: 'Company' },
  { token: 'company.website', label: 'Website', sample: 'ameyaheights.com', group: 'Company' },

  { token: 'sender.name', label: 'Your name', sample: 'Sahil Nahar', group: 'Sender' },
  { token: 'today', label: "Today's date", sample: '21 Jul 2026', group: 'Sender' },
];

export const MERGE_TOKENS = new Set(MERGE_FIELDS.map((f) => f.token));
export const SAMPLE_VALUES: Record<string, string> = Object.fromEntries(MERGE_FIELDS.map((f) => [f.token, f.sample]));

export const CHANNELS = [
  { key: 'WHATSAPP', label: 'WhatsApp', hint: 'Needs Meta approval before you can message first. Best for reminders buyers actually read.' },
  { key: 'EMAIL', label: 'Email', hint: 'No approval needed. Good for statements, letters and anything long.' },
  { key: 'SMS', label: 'SMS', hint: 'No approval here, but your SMS gateway will need DLT registration in India.' },
  { key: 'LETTER', label: 'Letter / PDF', hint: 'Rendered on your letterhead and downloadable. For demand notices and allotments.' },
] as const;

export const WA_CATEGORIES = [
  { key: 'UTILITY', label: 'Utility', hint: 'Payment reminders, receipts, booking updates. Cheapest, approved fastest.' },
  { key: 'MARKETING', label: 'Marketing', hint: 'New launches, offers. Costs more and buyers can opt out.' },
  { key: 'AUTHENTICATION', label: 'Authentication', hint: 'One-time passcodes only.' },
] as const;
