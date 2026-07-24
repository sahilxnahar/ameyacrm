/**
 * The free extras catalogue.
 *
 * Everything here is a preset built from things the CRM already does — an
 * automation rule, an email template, a saved view, a set of custom fields, a
 * commission structure. Nothing needs an account, nothing costs money, and
 * every install is reversible.
 *
 * Kept out of the actions file because a `'use server'` module may only export
 * async functions.
 */

export type ExtraKind = 'automation' | 'template' | 'view' | 'fields' | 'incentive';
export type ExtraCategory = 'Sales' | 'Collections' | 'Buyer care' | 'Team' | 'NRI';

export interface Extra {
  id: string;
  name: string;
  category: ExtraCategory;
  kind: ExtraKind;
  what: string;              // plain-English description of the benefit
  creates: string;           // exactly what appears after installing
  payload: Record<string, unknown>;
}

export const EXTRAS: Extra[] = [
  // ── Sales ────────────────────────────────────────────────────────────────
  {
    id: 'auto-followup-task',
    name: 'Follow up every new enquiry within a day',
    category: 'Sales', kind: 'automation',
    what: 'The moment an enquiry arrives, a follow-up task appears for whoever owns it, due tomorrow. Nothing sits untouched.',
    creates: 'One automation rule on "lead created"',
    payload: {
      name: 'Follow up new enquiry within a day',
      description: 'Creates a high-priority follow-up task as soon as a lead is created.',
      trigger: 'LEAD_CREATED',
      actions: [{ type: 'CREATE_TASK', params: { title: 'Call the new enquiry', dueInDays: 1, priority: 'HIGH' } }],
    },
  },
  {
    id: 'auto-hot-lead-alert',
    name: 'Tell a manager when a big enquiry lands',
    category: 'Sales', kind: 'automation',
    what: 'Any enquiry with a budget above ₹1 crore notifies management immediately, so a large buyer is never handled casually.',
    creates: 'One automation rule with a budget condition',
    payload: {
      name: 'Alert on high-budget enquiry',
      description: 'Notifies management when a lead states a budget above ₹1 crore.',
      trigger: 'LEAD_CREATED',
      conditions: [{ field: 'budgetMax', op: 'gte', value: 10000000 }],
      actions: [{ type: 'NOTIFY_ROLE', params: { role: 'MANAGER', title: 'High-budget enquiry received' } }],
    },
  },
  {
    id: 'view-untouched-leads',
    name: 'Enquiries nobody has touched',
    category: 'Sales', kind: 'view',
    what: 'A saved list of leads still sitting at New. The first thing to check every morning.',
    creates: 'A shared saved view on leads',
    payload: { name: 'Untouched enquiries', entity: 'lead', filters: { status: 'NEW' } },
  },
  {
    id: 'view-hot-leads',
    name: 'Hot leads, oldest first',
    category: 'Sales', kind: 'view',
    what: 'Everyone marked hot, with the ones waiting longest at the top — where deals are actually lost.',
    creates: 'A shared saved view on leads',
    payload: { name: 'Hot leads — oldest first', entity: 'lead', filters: { temperature: 'HOT', sort: 'updatedAt:asc' } },
  },
  {
    id: 'tpl-site-visit',
    name: 'Site visit confirmation email',
    category: 'Sales', kind: 'template',
    what: 'A written confirmation after a visit is booked. Fewer no-shows, and it looks professional.',
    creates: 'An email template you can edit',
    payload: {
      key: 'site-visit-confirmation',
      name: 'Site visit confirmation',
      subject: 'Your site visit to {{project}} — {{date}}',
      body: 'Dear {{name}},\n\nThank you for your interest in {{project}}. Your visit is confirmed for {{date}} at {{time}}.\n\nOur site is at:\n{{siteAddress}}\n\nDo carry a photo ID. If the time no longer suits you, reply to this email and we will rearrange it.\n\nWe look forward to meeting you.\n\n{{companyName}}\n{{website}}',
    },
  },

  // ── Collections ──────────────────────────────────────────────────────────
  {
    id: 'tpl-demand-notice',
    name: 'Payment demand notice',
    category: 'Collections', kind: 'template',
    what: 'The letter that goes out when a construction milestone falls due. Firm, courteous, and consistent every time.',
    creates: 'An email template you can edit',
    payload: {
      key: 'demand-notice',
      name: 'Payment demand notice',
      subject: 'Payment due — {{unit}}, {{milestone}}',
      body: 'Dear {{name}},\n\nAs per the payment schedule for {{unit}}, the instalment for "{{milestone}}" of {{amount}} falls due on {{dueDate}}.\n\nPayment details:\n{{bankDetails}}\n\nKindly share the transaction reference once paid so that we may update your ledger.\n\n{{companyName}}\nGSTIN {{gstin}}',
    },
  },
  {
    id: 'tpl-gentle-reminder',
    name: 'Overdue payment reminder',
    category: 'Collections', kind: 'template',
    what: 'A follow-up for money already late — polite the first time, so the relationship survives the chase.',
    creates: 'An email template you can edit',
    payload: {
      key: 'payment-reminder',
      name: 'Overdue payment reminder',
      subject: 'Gentle reminder — payment for {{unit}}',
      body: 'Dear {{name}},\n\nOur records show the instalment of {{amount}} for {{unit}} ({{milestone}}) was due on {{dueDate}} and is still outstanding.\n\nIf you have already paid, please ignore this note and send us the transaction reference so we can update our records.\n\nPayment details:\n{{bankDetails}}\n\n{{companyName}}',
    },
  },
  {
    id: 'view-overdue-collections',
    name: 'Money more than 30 days late',
    category: 'Collections', kind: 'view',
    what: 'The instalments that have slipped furthest. Work this list top down once a week.',
    creates: 'A shared saved view on collections',
    payload: { name: 'Overdue over 30 days', entity: 'collection', filters: { status: 'OVERDUE', olderThanDays: 30 } },
  },

  // ── Buyer care ───────────────────────────────────────────────────────────
  {
    id: 'tpl-welcome-buyer',
    name: 'Welcome letter for a new buyer',
    category: 'Buyer care', kind: 'template',
    what: 'Sent the day a booking is confirmed, with their portal link. Sets the tone for the next two years.',
    creates: 'An email template you can edit',
    payload: {
      key: 'buyer-welcome',
      name: 'Buyer welcome letter',
      subject: 'Welcome to {{project}} — your home {{unit}}',
      body: 'Dear {{name}},\n\nCongratulations, and welcome to {{project}}.\n\nYour home {{unit}} is now recorded in our system. You can follow construction progress, see your payment schedule and download your documents here:\n\n{{portalLink}}\n\nAny question at all, reply to this email and one of us will come back to you.\n\n{{companyName}}\n{{website}}',
    },
  },
  {
    id: 'fields-handover',
    name: 'Handover checklist fields',
    category: 'Buyer care', kind: 'fields',
    what: 'Records what actually happened at possession — keys given, meters transferred, snags noted.',
    creates: 'Five custom fields on bookings',
    payload: {
      entity: 'booking',
      fields: [
        { key: 'handoverDate', label: 'Handover date', type: 'date' },
        { key: 'keysHandedTo', label: 'Keys handed to', type: 'text' },
        { key: 'electricityMeter', label: 'Electricity meter number', type: 'text' },
        { key: 'waterConnection', label: 'Water connection transferred', type: 'checkbox' },
        { key: 'snagsAtHandover', label: 'Snags noted at handover', type: 'text' },
      ],
    },
  },

  // ── NRI ──────────────────────────────────────────────────────────────────
  {
    id: 'fields-nri',
    name: 'NRI buyer pack',
    category: 'NRI', kind: 'fields',
    what: 'The extra details an overseas buyer needs recorded — country, best time to call, NRE/NRO account, POA holder.',
    creates: 'Five custom fields on leads',
    payload: {
      entity: 'lead',
      fields: [
        { key: 'countryOfResidence', label: 'Country of residence', type: 'text' },
        { key: 'bestTimeToCall', label: 'Best time to call (their time)', type: 'text' },
        { key: 'accountType', label: 'Funding account', type: 'select', options: ['NRE', 'NRO', 'FCNR', 'Indian resident account'] },
        { key: 'poaHolder', label: 'Power of attorney holder', type: 'text' },
        { key: 'passportNumber', label: 'Passport number', type: 'text' },
      ],
    },
  },
  {
    id: 'tpl-nri-intro',
    name: 'NRI enquiry first reply',
    category: 'NRI', kind: 'template',
    what: 'Answers the questions every overseas buyer asks — remittance, POA, registration in absentia — before they have to ask.',
    creates: 'An email template you can edit',
    payload: {
      key: 'nri-first-reply',
      name: 'NRI enquiry — first reply',
      subject: 'Your enquiry about {{project}}',
      body: 'Dear {{name}},\n\nThank you for your interest in {{project}}.\n\nA few things overseas buyers usually ask us straight away:\n\n• Payment may be made from an NRE, NRO or FCNR account, or by normal banking channels.\n• Registration can be completed by a power of attorney holder in India if you cannot travel.\n• We can arrange a video walkthrough of the site and of any specific home.\n\nPlease let me know a time that suits you in your timezone and I will call.\n\n{{companyName}}\n{{website}}',
    },
  },

  // ── Team ─────────────────────────────────────────────────────────────────
  {
    id: 'incentive-standard',
    name: 'Standard commission structure',
    category: 'Team', kind: 'incentive',
    what: 'A three-tier slab that rewards larger sales more. A sensible starting point you can adjust.',
    creates: 'Three commission slabs',
    payload: {
      slabs: [
        { name: 'Up to ₹75 lakh', fromValue: 0, toValue: 7500000, ratePercent: 0.4 },
        { name: '₹75 lakh to ₹1.5 crore', fromValue: 7500001, toValue: 15000000, ratePercent: 0.5 },
        { name: 'Above ₹1.5 crore', fromValue: 15000001, toValue: null, ratePercent: 0.6, flatAmount: 25000 },
      ],
    },
  },
  {
    id: 'auto-stale-lead',
    name: 'Nudge when an enquiry goes quiet',
    category: 'Team', kind: 'automation',
    what: 'If a qualified lead has had no activity for a week, a task appears to chase it before it goes cold.',
    creates: 'One scheduled automation rule',
    payload: {
      name: 'Chase enquiries gone quiet for a week',
      description: 'Creates a task for leads with no activity in seven days.',
      trigger: 'SCHEDULE',
      conditions: [{ field: 'status', op: 'in', value: ['QUALIFIED', 'SITE_VISIT', 'NEGOTIATION'] }],
      actions: [{ type: 'CREATE_TASK', params: { title: 'This enquiry has gone quiet — chase it', dueInDays: 0, priority: 'HIGH' } }],
    },
  },
];

export const EXTRA_CATEGORIES: ExtraCategory[] = ['Sales', 'Collections', 'Buyer care', 'NRI', 'Team'];
