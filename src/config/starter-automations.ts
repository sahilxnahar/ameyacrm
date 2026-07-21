/**
 * Ready-made automations, grouped by the department that feels the benefit.
 *
 * Honest scope: the engine can currently react to a lead being created, a lead
 * changing stage, a task being created, a task changing status, and a daily
 * schedule. So every rule below hangs off one of those. Departments whose work
 * is not lead-driven get task-driven rules instead — which is what actually
 * fires, rather than a rule that looks impressive and never runs.
 *
 * `startHere` marks the three to switch on first: each one is easy to see
 * working within a day, which is the fastest way to learn the feature.
 */
export interface StarterAutomation {
  key: string;
  name: string;
  department: string;
  startHere?: boolean;
  what: string;            // plain English, for the person choosing
  why: string;             // why it is worth switching on
  trigger: 'LEAD_CREATED' | 'LEAD_STAGE_CHANGED' | 'TASK_CREATED' | 'TASK_STATUS_CHANGED' | 'SCHEDULE';
  matchAll?: boolean;
  conditions?: Array<{ field: string; op: string; value?: string }>;
  actions: Array<{ type: string; params: Record<string, unknown> }>;
  elseActions?: Array<{ type: string; params: Record<string, unknown> }>;
  slaMinutes?: number;
}

export const STARTER_AUTOMATIONS: StarterAutomation[] = [
  // ── Sales ────────────────────────────────────────────────────────────────
  {
    key: 'sales_assign_new_lead',
    name: 'Share out every new enquiry',
    department: 'Sales',
    startHere: true,
    what: 'The moment an enquiry arrives, it is given to the next sales person in turn and they are told.',
    why: 'An unassigned lead is nobody\'s job. This is the single rule most worth having on.',
    trigger: 'LEAD_CREATED',
    actions: [
      { type: 'ASSIGN_ROUND_ROBIN', params: { role: 'EXECUTIVE' } },
      { type: 'CREATE_TASK', params: { title: 'Call the new enquiry', dueInDays: 1, priority: 'HIGH' } },
    ],
  },
  {
    key: 'sales_big_budget_alert',
    name: 'Flag a high-value enquiry to a manager',
    department: 'Sales',
    what: 'When an enquiry says its budget is above one crore, every manager is notified straight away.',
    why: 'Large enquiries deserve a senior call within the hour, not whenever the queue reaches them.',
    trigger: 'LEAD_CREATED',
    conditions: [{ field: 'budgetMax', op: 'gte', value: '10000000' }],
    actions: [{ type: 'NOTIFY_ROLE', params: { role: 'MANAGER', title: 'High-value enquiry just came in' } }],
  },
  {
    key: 'sales_won_handover',
    name: 'Start the paperwork when a deal is won',
    department: 'Sales',
    what: 'When a lead is marked won, a booking-paperwork task is raised with a three-day deadline.',
    why: 'The gap between a verbal yes and signed papers is where deals quietly die.',
    trigger: 'LEAD_STAGE_CHANGED',
    conditions: [{ field: 'status', op: 'eq', value: 'WON' }],
    actions: [{ type: 'CREATE_TASK', params: { title: 'Prepare booking paperwork', dueInDays: 3, priority: 'HIGH' } }],
  },

  // ── Marketing ────────────────────────────────────────────────────────────
  {
    key: 'marketing_portal_lead_followup',
    name: 'Chase portal enquiries the same day',
    department: 'Marketing',
    startHere: true,
    what: 'Enquiries from the website or a property portal get a same-day callback task.',
    why: 'Portal leads go to four builders at once. Whoever calls first usually wins.',
    trigger: 'LEAD_CREATED',
    matchAll: false,
    conditions: [
      { field: 'source', op: 'eq', value: 'WEBSITE' },
      { field: 'source', op: 'eq', value: 'PORTAL' },
    ],
    actions: [{ type: 'CREATE_TASK', params: { title: 'Call back a portal enquiry today', dueInDays: 0, priority: 'URGENT' } }],
  },
  {
    key: 'marketing_lost_reason',
    name: 'Insist on a reason when an enquiry is lost',
    department: 'Marketing',
    what: 'If a lead is marked lost without a reason, a task is raised to fill it in.',
    why: 'Without lost reasons you cannot tell whether the problem is price, product or follow-up.',
    trigger: 'LEAD_STAGE_CHANGED',
    conditions: [{ field: 'status', op: 'eq', value: 'LOST' }, { field: 'lostReason', op: 'is_empty' }],
    actions: [{ type: 'CREATE_TASK', params: { title: 'Record why this enquiry was lost', dueInDays: 1, priority: 'MEDIUM' } }],
  },
  {
    key: 'marketing_nri_desk',
    name: 'Route NRI enquiries to the NRI desk',
    department: 'Marketing',
    what: 'An enquiry flagged as NRI notifies department heads so it reaches the right desk.',
    why: 'NRI buyers need different paperwork and a call at a different hour.',
    trigger: 'LEAD_CREATED',
    conditions: [{ field: 'isNri', op: 'is_true' }],
    actions: [{ type: 'NOTIFY_ROLE', params: { role: 'DEPARTMENT_HEAD', title: 'An NRI enquiry has arrived' } }],
  },

  // ── Site Operations ──────────────────────────────────────────────────────
  {
    key: 'site_urgent_task_visibility',
    name: 'Make urgent site work visible to managers',
    department: 'Site Operations',
    startHere: true,
    what: 'Any task raised as urgent notifies every manager the moment it is created.',
    why: 'Urgent work raised at site should not wait for someone to open the CRM.',
    trigger: 'TASK_CREATED',
    conditions: [{ field: 'priority', op: 'eq', value: 'URGENT' }],
    actions: [{ type: 'NOTIFY_ROLE', params: { role: 'MANAGER', title: 'Urgent work has been raised' } }],
  },
  {
    key: 'site_blocked_escalation',
    name: 'Escalate work that gets stuck',
    department: 'Site Operations',
    what: 'When a task is moved to blocked, department heads are told.',
    why: 'Blocked work is the cheapest problem to fix and the most expensive to ignore.',
    trigger: 'TASK_STATUS_CHANGED',
    conditions: [{ field: 'status', op: 'eq', value: 'BLOCKED' }],
    actions: [{ type: 'NOTIFY_ROLE', params: { role: 'DEPARTMENT_HEAD', title: 'A job is blocked at site' } }],
  },
  {
    key: 'site_completion_check',
    name: 'Check work that is marked done',
    department: 'Site Operations',
    what: 'When a task is completed, a short verification task is raised for the next day.',
    why: 'Marking something done and it actually being done are not the same thing at site.',
    trigger: 'TASK_STATUS_CHANGED',
    conditions: [{ field: 'status', op: 'eq', value: 'DONE' }, { field: 'priority', op: 'in', value: 'HIGH,URGENT' }],
    actions: [{ type: 'CREATE_TASK', params: { title: 'Verify the completed work at site', dueInDays: 1, priority: 'MEDIUM' } }],
  },

  // ── Billing & Accounts ───────────────────────────────────────────────────
  {
    key: 'billing_urgent_payment_visibility',
    name: 'Tell accounts about urgent payment work',
    department: 'Billing',
    what: 'A task mentioning payment, invoice or bill, raised as high or urgent, notifies admins.',
    why: 'A missed vendor payment costs goodwill that takes months to rebuild.',
    trigger: 'TASK_CREATED',
    conditions: [{ field: 'title', op: 'contains', value: 'payment' }, { field: 'priority', op: 'in', value: 'HIGH,URGENT' }],
    actions: [{ type: 'NOTIFY_ROLE', params: { role: 'ADMIN', title: 'Urgent payment work raised' } }],
  },
  {
    key: 'accounts_gst_monthly',
    name: 'Raise the GST filing task each month',
    department: 'Accounts',
    what: 'On a schedule, a GST filing task is raised so the twentieth never arrives as a surprise.',
    why: 'Late GST filing is an automatic penalty and entirely avoidable.',
    trigger: 'SCHEDULE',
    actions: [{ type: 'CREATE_TASK', params: { title: 'File GSTR-3B for last month', dueInDays: 5, priority: 'HIGH' } }],
  },
  {
    key: 'accounts_reconcile_weekly',
    name: 'Reconcile the bank against the cash book',
    department: 'Accounts',
    what: 'A recurring task to tick the cash book off against the bank statement.',
    why: 'Reconciling weekly turns a painful year-end into twenty minutes at a time.',
    trigger: 'SCHEDULE',
    actions: [{ type: 'CREATE_TASK', params: { title: 'Reconcile the bank statement against the cash book', dueInDays: 2, priority: 'MEDIUM' } }],
  },

  // ── Architecture & Document Control ──────────────────────────────────────
  {
    key: 'architecture_drawing_review',
    name: 'Review every drawing that comes in',
    department: 'Architecture',
    what: 'A task whose title mentions a drawing raises a review task alongside it.',
    why: 'A drawing that reaches site unreviewed is the most expensive kind of mistake.',
    trigger: 'TASK_CREATED',
    conditions: [{ field: 'title', op: 'contains', value: 'drawing' }],
    actions: [{ type: 'CREATE_TASK', params: { title: 'Review the incoming drawing before it goes to site', dueInDays: 2, priority: 'HIGH' } }],
  },
  {
    key: 'doc_control_approval_chase',
    name: 'Chase approvals that are still open',
    department: 'Document Control',
    what: 'A task mentioning approval, sanction or licence notifies department heads when raised.',
    why: 'Statutory approvals have queues. Starting a week early costs nothing.',
    trigger: 'TASK_CREATED',
    matchAll: false,
    conditions: [
      { field: 'title', op: 'contains', value: 'approval' },
      { field: 'title', op: 'contains', value: 'sanction' },
      { field: 'title', op: 'contains', value: 'licence' },
    ],
    actions: [{ type: 'NOTIFY_ROLE', params: { role: 'DEPARTMENT_HEAD', title: 'Approval work has been raised' } }],
  },

  // ── Legal, HR, Management, Lease ─────────────────────────────────────────
  {
    key: 'legal_agreement_review',
    name: 'Route agreements to a second pair of eyes',
    department: 'Legal',
    what: 'A task mentioning an agreement or contract raises a review task.',
    why: 'Nothing signed should have been read by only one person.',
    trigger: 'TASK_CREATED',
    matchAll: false,
    conditions: [
      { field: 'title', op: 'contains', value: 'agreement' },
      { field: 'title', op: 'contains', value: 'contract' },
    ],
    actions: [{ type: 'CREATE_TASK', params: { title: 'Legal review before signing', dueInDays: 3, priority: 'HIGH' } }],
  },
  {
    key: 'hr_onboarding_checklist',
    name: 'Start the joining checklist',
    department: 'Human Resources',
    what: 'A task mentioning joining or onboarding raises the paperwork checklist task.',
    why: 'The first week sets the tone, and it is always the week everyone is busiest.',
    trigger: 'TASK_CREATED',
    matchAll: false,
    conditions: [
      { field: 'title', op: 'contains', value: 'joining' },
      { field: 'title', op: 'contains', value: 'onboard' },
    ],
    actions: [{ type: 'CREATE_TASK', params: { title: 'Complete joining paperwork and system access', dueInDays: 3, priority: 'MEDIUM' } }],
  },
  {
    key: 'management_weekly_review',
    name: 'Put a weekly review in the diary',
    department: 'Management',
    what: 'A recurring task to look at pipeline, spend and site progress together.',
    why: 'The three numbers only mean something next to each other.',
    trigger: 'SCHEDULE',
    actions: [{ type: 'CREATE_TASK', params: { title: 'Weekly review: pipeline, spend and site progress', dueInDays: 1, priority: 'MEDIUM' } }],
  },
  {
    key: 'lease_renewal_watch',
    name: 'Start lease renewals early',
    department: 'Lease',
    what: 'A recurring task to check which leases fall due in the next quarter.',
    why: 'A renewal negotiated three months out is a much better deal than one done in the last week.',
    trigger: 'SCHEDULE',
    actions: [{ type: 'CREATE_TASK', params: { title: 'Check leases falling due next quarter', dueInDays: 7, priority: 'MEDIUM' } }],
  },
  {
    key: 'admin_stale_task_sweep',
    name: 'Sweep up work nobody has touched',
    department: 'Administration',
    what: 'A recurring task to review anything still sitting in to-do.',
    why: 'Every list grows a tail. This keeps the tail short enough to be honest.',
    trigger: 'SCHEDULE',
    actions: [{ type: 'CREATE_TASK', params: { title: 'Review tasks that have not moved this week', dueInDays: 2, priority: 'LOW' } }],
  },

  // ── More, added on request ───────────────────────────────────────────────
  {
    key: 'sales_stale_lead_nudge',
    name: 'Chase an enquiry that has gone quiet',
    department: 'Sales',
    what: 'Every day, a task is raised to work through enquiries nobody has touched.',
    why: 'Most lost sales are not lost on price. They are lost on silence.',
    trigger: 'SCHEDULE',
    actions: [{ type: 'CREATE_TASK', params: { title: 'Work through enquiries with no contact this week', dueInDays: 1, priority: 'HIGH' } }],
  },
  {
    key: 'sales_site_visit_prep',
    name: 'Prepare before a site visit',
    department: 'Sales',
    what: 'When an enquiry reaches site-visit stage, a preparation task is raised for the day before.',
    why: 'A visit where the unit is not ready to show costs you the sale and the referral.',
    trigger: 'LEAD_STAGE_CHANGED',
    conditions: [{ field: 'status', op: 'eq', value: 'SITE_VISIT' }],
    actions: [{ type: 'CREATE_TASK', params: { title: 'Get the unit and paperwork ready for the visit', dueInDays: 1, priority: 'HIGH' } }],
  },
  {
    key: 'sales_negotiation_watch',
    name: 'Put a manager on every negotiation',
    department: 'Sales',
    what: 'When an enquiry reaches negotiation, managers are notified.',
    why: 'Discount decisions should not be made alone at the end of a long month.',
    trigger: 'LEAD_STAGE_CHANGED',
    conditions: [{ field: 'status', op: 'eq', value: 'NEGOTIATION' }],
    actions: [{ type: 'NOTIFY_ROLE', params: { role: 'MANAGER', title: 'An enquiry has moved into negotiation' } }],
  },
  {
    key: 'marketing_referral_thanks',
    name: 'Never let a referral go unthanked',
    department: 'Marketing',
    what: 'A referred enquiry raises a task to thank whoever sent it.',
    why: 'Referrals compound only if the last one was acknowledged.',
    trigger: 'LEAD_CREATED',
    conditions: [{ field: 'source', op: 'eq', value: 'REFERRAL' }],
    actions: [{ type: 'CREATE_TASK', params: { title: 'Thank the person who made this referral', dueInDays: 2, priority: 'MEDIUM' } }],
  },
  {
    key: 'marketing_broker_lead',
    name: 'Acknowledge a broker enquiry quickly',
    department: 'Marketing',
    what: 'A broker-sourced enquiry raises a same-day acknowledgement task.',
    why: 'Brokers send the next one to whoever answered fastest last time.',
    trigger: 'LEAD_CREATED',
    conditions: [{ field: 'source', op: 'eq', value: 'BROKER' }],
    actions: [{ type: 'CREATE_TASK', params: { title: 'Acknowledge the broker and confirm the lead is registered', dueInDays: 0, priority: 'HIGH' } }],
  },
  {
    key: 'billing_weekly_dues',
    name: 'Review what buyers still owe',
    department: 'Billing',
    what: 'A recurring task to go through outstanding instalments.',
    why: 'Collections slip quietly. A weekly look keeps the number honest.',
    trigger: 'SCHEDULE',
    actions: [{ type: 'CREATE_TASK', params: { title: 'Review outstanding buyer instalments and chase', dueInDays: 2, priority: 'HIGH' } }],
  },
  {
    key: 'billing_utr_backfill',
    name: 'Fill in any missing UTRs',
    department: 'Billing',
    what: 'A recurring task to record bank references against payments that have none.',
    why: 'A payment with no UTR cannot be matched to the statement later.',
    trigger: 'SCHEDULE',
    actions: [{ type: 'CREATE_TASK', params: { title: 'Record UTRs for bank payments that are missing one', dueInDays: 3, priority: 'MEDIUM' } }],
  },
  {
    key: 'accounts_tds_monthly',
    name: 'Deposit TDS on time',
    department: 'Accounts',
    what: 'A recurring task for the monthly TDS deposit.',
    why: 'Interest on late TDS is charged per month and is never worth it.',
    trigger: 'SCHEDULE',
    actions: [{ type: 'CREATE_TASK', params: { title: 'Deposit TDS for last month', dueInDays: 4, priority: 'HIGH' } }],
  },
  {
    key: 'architecture_revision_control',
    name: 'Withdraw superseded drawings',
    department: 'Architecture',
    what: 'A task mentioning a revision raises a task to pull the old version from site.',
    why: 'Two versions of one drawing on site is how walls get built twice.',
    trigger: 'TASK_CREATED',
    matchAll: false,
    conditions: [
      { field: 'title', op: 'contains', value: 'revision' },
      { field: 'title', op: 'contains', value: 'rev ' },
    ],
    actions: [{ type: 'CREATE_TASK', params: { title: 'Withdraw the superseded drawing from site', dueInDays: 1, priority: 'HIGH' } }],
  },
  {
    key: 'doc_control_expiry_sweep',
    name: 'Check what is about to expire',
    department: 'Document Control',
    what: 'A recurring task to look for approvals, licences and insurance running out.',
    why: 'An expired approval stops work on site the same morning you find out.',
    trigger: 'SCHEDULE',
    actions: [{ type: 'CREATE_TASK', params: { title: 'Check approvals, licences and insurance expiring soon', dueInDays: 5, priority: 'HIGH' } }],
  },
  {
    key: 'legal_dispute_escalation',
    name: 'Escalate anything that sounds like a dispute',
    department: 'Legal',
    what: 'A task mentioning a notice, dispute or complaint notifies admins immediately.',
    why: 'Legal problems get cheaper the earlier someone senior sees them.',
    trigger: 'TASK_CREATED',
    matchAll: false,
    conditions: [
      { field: 'title', op: 'contains', value: 'notice' },
      { field: 'title', op: 'contains', value: 'dispute' },
      { field: 'title', op: 'contains', value: 'complaint' },
    ],
    actions: [{ type: 'NOTIFY_ROLE', params: { role: 'ADMIN', title: 'Something legal has been raised' } }],
  },
  {
    key: 'hr_exit_checklist',
    name: 'Close out a leaver properly',
    department: 'Human Resources',
    what: 'A task mentioning resignation or exit raises the handover and access-removal checklist.',
    why: 'The access nobody revoked is the access nobody remembers.',
    trigger: 'TASK_CREATED',
    matchAll: false,
    conditions: [
      { field: 'title', op: 'contains', value: 'resign' },
      { field: 'title', op: 'contains', value: 'exit' },
    ],
    actions: [{ type: 'CREATE_TASK', params: { title: 'Handover, final settlement and remove system access', dueInDays: 5, priority: 'HIGH' } }],
  },
  {
    key: 'site_material_shortage',
    name: 'Treat a material shortage as urgent',
    department: 'Site Operations',
    what: 'A task mentioning a shortage or that something is out of stock notifies managers.',
    why: 'Idle labour costs more per day than the material being waited on.',
    trigger: 'TASK_CREATED',
    matchAll: false,
    conditions: [
      { field: 'title', op: 'contains', value: 'shortage' },
      { field: 'title', op: 'contains', value: 'out of stock' },
    ],
    actions: [{ type: 'NOTIFY_ROLE', params: { role: 'MANAGER', title: 'A material shortage has been reported' } }],
  },
  {
    key: 'lease_rent_review',
    name: 'Collect rent on time',
    department: 'Lease',
    what: 'A recurring task to check rent received against what is due.',
    why: 'Rent slipping a month becomes rent slipping a quarter.',
    trigger: 'SCHEDULE',
    actions: [{ type: 'CREATE_TASK', params: { title: 'Check rent received against what was due', dueInDays: 3, priority: 'MEDIUM' } }],
  },
  {
    key: 'management_cash_position',
    name: 'Look at the cash position weekly',
    department: 'Management',
    what: 'A recurring task to review money in, money out and what is committed.',
    why: 'Cash surprises are always the expensive kind.',
    trigger: 'SCHEDULE',
    actions: [{ type: 'CREATE_TASK', params: { title: 'Review cash in, cash out and committed spend', dueInDays: 1, priority: 'HIGH' } }],
  },

  // ── Topping every department up to at least three ────────────────────────
  {
    key: 'admin_access_review',
    name: 'Review who can get into the CRM',
    department: 'Administration',
    what: 'A recurring task to check the user list and remove anyone who has left.',
    why: 'Leavers keep access far longer than anyone expects.',
    trigger: 'SCHEDULE',
    actions: [{ type: 'CREATE_TASK', params: { title: 'Review CRM users and remove anyone who has left', dueInDays: 5, priority: 'MEDIUM' } }],
  },
  {
    key: 'admin_backup_check',
    name: 'Confirm the backup actually ran',
    department: 'Administration',
    what: 'A recurring task to verify the database backup exists and can be restored.',
    why: 'An untested backup is a rumour, not a backup.',
    trigger: 'SCHEDULE',
    actions: [{ type: 'CREATE_TASK', params: { title: 'Verify the latest backup and test a restore', dueInDays: 7, priority: 'HIGH' } }],
  },
  {
    key: 'architecture_boq_check',
    name: 'Cross-check quantities against the drawing',
    department: 'Architecture',
    what: 'A task mentioning BOQ or quantities raises a cross-check task.',
    why: 'A quantity error found on paper costs nothing. Found at site it costs a slab.',
    trigger: 'TASK_CREATED',
    matchAll: false,
    conditions: [
      { field: 'title', op: 'contains', value: 'boq' },
      { field: 'title', op: 'contains', value: 'quantit' },
    ],
    actions: [{ type: 'CREATE_TASK', params: { title: 'Cross-check quantities against the latest drawing', dueInDays: 2, priority: 'HIGH' } }],
  },
  {
    key: 'doc_control_filing_sweep',
    name: 'File what is sitting loose',
    department: 'Document Control',
    what: 'A recurring task to move anything unfiled into the right folder.',
    why: 'A document nobody can find is a document you do not have.',
    trigger: 'SCHEDULE',
    actions: [{ type: 'CREATE_TASK', params: { title: 'File anything sitting in Unfiled into the right folder', dueInDays: 3, priority: 'LOW' } }],
  },
  {
    key: 'hr_probation_review',
    name: 'Hold probation reviews on time',
    department: 'Human Resources',
    what: 'A recurring task to check who is due a probation or appraisal conversation.',
    why: 'A review held late is a review that has already lost its usefulness.',
    trigger: 'SCHEDULE',
    actions: [{ type: 'CREATE_TASK', params: { title: 'Check who is due a probation or appraisal review', dueInDays: 7, priority: 'MEDIUM' } }],
  },
  {
    key: 'lease_deposit_watch',
    name: 'Track deposits held and returned',
    department: 'Lease',
    what: 'A recurring task to reconcile security deposits against active leases.',
    why: 'Deposits are somebody else\'s money and are easy to lose track of.',
    trigger: 'SCHEDULE',
    actions: [{ type: 'CREATE_TASK', params: { title: 'Reconcile security deposits against active leases', dueInDays: 5, priority: 'MEDIUM' } }],
  },
  {
    key: 'legal_compliance_calendar',
    name: 'Keep the statutory calendar current',
    department: 'Legal',
    what: 'A recurring task to review RERA, ROC and other statutory dates coming up.',
    why: 'Statutory deadlines do not move and the penalties are automatic.',
    trigger: 'SCHEDULE',
    actions: [{ type: 'CREATE_TASK', params: { title: 'Review upcoming RERA, ROC and statutory deadlines', dueInDays: 7, priority: 'HIGH' } }],
  },
  {
    key: 'management_escalation_review',
    name: 'Look at what keeps going overdue',
    department: 'Management',
    what: 'A recurring task to review which work is repeatedly missing its date.',
    why: 'The same job going overdue three times is a resourcing problem, not a reminder problem.',
    trigger: 'SCHEDULE',
    actions: [{ type: 'CREATE_TASK', params: { title: 'Review work that keeps going overdue and why', dueInDays: 3, priority: 'MEDIUM' } }],
  },
];

export const STARTER_DEPARTMENTS = [...new Set(STARTER_AUTOMATIONS.map((a) => a.department))];
