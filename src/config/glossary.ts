/**
 * Plain-English meanings for the terms this CRM uses. Real-estate, construction
 * and finance each bring their own vocabulary; a newcomer should never have to
 * leave the app to find out what a word means. The glossary page reads this
 * list, and any screen can drop a `<HelpTip termId="...">` that links here.
 *
 * Keep every `plain` line to one or two sentences, in words a layman knows.
 */
export interface GlossaryTerm {
  id: string;
  term: string;
  plain: string;
  /** Where in the app this shows up, so people can connect the word to a screen. */
  where?: string;
  /** Extra searchable words (abbreviations, synonyms). */
  aka?: string[];
}

export const GLOSSARY: GlossaryTerm[] = [
  { id: 'lead', term: 'Lead', plain: 'A person who has shown interest in buying — an enquiry. It becomes a booking if they buy.', where: 'Sales & Leads' },
  { id: 'lead-score', term: 'Lead score', plain: 'A number from 0–100 the CRM gives each enquiry to show how likely they are to buy. Higher means chase first.', where: 'Sales & Leads, Insights' },
  { id: 'temperature', term: 'Lead temperature', plain: 'A simple hot / warm / cold label for how keen a buyer is right now.', where: 'Sales & Leads' },
  { id: 'booking', term: 'Booking', plain: 'A unit a buyer has agreed to take, with the money and paperwork tracked against it.', where: 'Inventory & Bookings' },
  { id: 'unit', term: 'Unit', plain: 'One flat, shop or plot you can sell — the thing a buyer books.', where: 'Inventory' },
  { id: 'inventory', term: 'Inventory', plain: 'Everything you have to sell and its status: available, held, or sold.', where: 'Inventory' },
  { id: 'channel-partner', term: 'Channel partner', plain: 'An outside broker who brings you buyers and earns a commission for it.', where: 'Channel Partners', aka: ['broker', 'cp'] },
  { id: 'nri', term: 'NRI', plain: 'Non-Resident Indian — a buyer living abroad. They need extra care on time zones and paperwork.', where: 'NRI Desk', aka: ['non resident'] },
  { id: 'voucher', term: 'Voucher', plain: 'A record of money paid or received, with the amount, who to, and the bank reference (UTR).', where: 'Payments, Cash Book', aka: ['payment voucher'] },
  { id: 'utr', term: 'UTR', plain: 'The unique number a bank gives every transfer — proof a payment actually went through.', where: 'Payments', aka: ['unique transaction reference', 'bank reference'] },
  { id: 'receivable', term: 'Receivable', plain: 'Money buyers still owe you, and when each amount is due.', where: 'Money Owed To Us', aka: ['money owed'] },
  { id: 'milestone', term: 'Payment milestone', plain: 'A stage at which a buyer must pay — e.g. "on booking", "on slab casting". Together they add up to the full price.', where: 'Bookings' },
  { id: 'ledger', term: 'Ledger', plain: 'The full, permanent record of every rupee in and out — the accountant’s book.', where: 'Ledger' },
  { id: 'escrow', term: 'RERA escrow', plain: 'A special bank account where 70% of what buyers pay must sit, by law, and can only be spent on that project’s construction.', where: 'Capital & Escrow', aka: ['rera account'] },
  { id: 'rera', term: 'RERA', plain: 'The Real Estate Regulation Act — the rules developers must follow to protect buyers, including the escrow account and registration.', where: 'Capital, Statutory', aka: ['real estate regulation act'] },
  { id: 'covenant', term: 'Loan covenant', plain: 'A promise to a lender to keep some number within a limit (e.g. debt no more than X). Breaking it can trigger penalties.', where: 'Capital & Escrow' },
  { id: 'grn', term: 'GRN (Goods Receipt Note)', plain: 'A record of what actually arrived on site, so you can check it against what was ordered and what was billed.', where: 'Procurement', aka: ['goods receipt note', 'goods received'] },
  { id: 'three-way', term: 'Three-way match', plain: 'Checking that three things agree before you pay a bill: the order, what arrived, and the invoice. Stops overpaying.', where: 'Procurement' },
  { id: 'boq', term: 'BOQ', plain: 'Bill of Quantities — the priced list of every material and job a project needs.', where: 'Programme', aka: ['bill of quantities'] },
  { id: 'earned-value', term: 'Earned value', plain: 'A way to see if a project is ahead or behind by comparing the value of work actually done against what was planned.', where: 'Programme' },
  { id: 'rfi', term: 'RFI', plain: 'Request for Information — a formal question from site to the architect when a drawing is unclear.', where: 'Architecture', aka: ['request for information'] },
  { id: 'transmittal', term: 'Drawing transmittal', plain: 'A record of which drawing (and which version) was sent to whom, and when — so nobody builds from an old plan.', where: 'Drawing Transmittals' },
  { id: 'variation', term: 'Variation order', plain: 'A change a buyer asks for after booking — priced and agreed before the work, so there is no argument at handover.', where: 'Buyer Variations', aka: ['change order'] },
  { id: 'ncr', term: 'Non-conformance (NCR)', plain: 'A written note that something built does not meet the required standard, and must be fixed.', where: 'Quality & Safety', aka: ['non conformance report'] },
  { id: 'hold-point', term: 'Hold point', plain: 'A stage where work must stop for an inspection before it can carry on.', where: 'Quality & Safety' },
  { id: 'feasibility', term: 'Feasibility / appraisal', plain: 'A model that works out whether a project will make money before you commit to it.', where: 'Feasibility', aka: ['development appraisal'] },
  { id: 'cam', term: 'CAM', plain: 'Common Area Maintenance — the monthly charge residents pay to keep shared areas running.', where: 'Association & CAM', aka: ['common area maintenance', 'maintenance charge'] },
  { id: 'title-chain', term: 'Title chain', plain: 'The unbroken history of who owned a piece of land, proving the current seller really owns it.', where: 'Land & Approvals' },
  { id: 'statutory', term: 'Statutory obligation', plain: 'Something the law requires by a date — a filing, a renewal, a tax. Miss it and there are penalties.', where: 'Statutory Calendar' },
  { id: 'esg', term: 'ESG / EC conditions', plain: 'Environmental, Social and Governance duties — including the conditions attached to your Environmental Clearance.', where: 'Environment & ESG', aka: ['environmental clearance'] },
  { id: 'rbac', term: 'Permissions / RBAC', plain: 'Who is allowed to see and do what. Set by a person’s role, and adjustable per person.', where: 'Admin', aka: ['role based access', 'access control'] },
  { id: 'audit-trail', term: 'Audit trail', plain: 'An automatic record of who did what and when — useful when you need to know how something changed.', where: 'Audit Trail' },
  { id: 'reconciliation', term: 'Bank reconciliation', plain: 'Matching your records against the bank statement so every rupee is accounted for.', where: 'Cash Flow & Treasury' },
  { id: 'forecast', term: 'Forecast', plain: 'An estimate of where sales or cash are heading, based on what has happened so far.', where: 'Forecast, Treasury' },
];

export function glossaryById(id: string): GlossaryTerm | undefined {
  return GLOSSARY.find((t) => t.id === id);
}
