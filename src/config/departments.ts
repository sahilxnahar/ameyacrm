/**
 * The department catalogue for an Indian real-estate developer.
 *
 * Two levels: a division, and the teams inside it. Nothing here is created
 * automatically — an admin picks what applies from Admin > Departments. Most
 * firms use a third of this list; a large developer uses nearly all of it.
 */
export interface DeptSeed {
  slug: string;
  name: string;
  description: string;
  color: string;
  children: { slug: string; name: string; description: string }[];
}

export const DEPARTMENT_CATALOGUE: DeptSeed[] = [
  {
    slug: 'management',
    name: 'Management',
    description: 'Partners, strategy and everything that needs a final say.',
    color: '#A07D34',
    children: [
      { slug: 'board-strategy', name: 'Board & Strategy', description: 'Partner decisions, business planning, investor relations.' },
      { slug: 'project-management-office', name: 'Project Management Office', description: 'Cross-project schedules, budgets and reporting.' },
    ],
  },
  {
    slug: 'sales',
    name: 'Sales',
    description: 'Everyone who converts an enquiry into a booking.',
    color: '#1E5FD6',
    children: [
      { slug: 'pre-sales', name: 'Pre-Sales / CRM Desk', description: 'First response, qualification and site-visit booking.' },
      { slug: 'direct-sales', name: 'Direct Sales', description: 'Walk-ins, referrals and closings handled in-house.' },
      { slug: 'channel-partners', name: 'Channel Partners', description: 'Broker onboarding, lead locks and brokerage payouts.' },
      { slug: 'nri-sales', name: 'NRI Sales', description: 'Overseas buyers, FEMA paperwork and time-zone coverage.' },
      { slug: 'corporate-bulk-sales', name: 'Corporate & Bulk Sales', description: 'Institutional buyers and multi-unit deals.' },
    ],
  },
  {
    slug: 'marketing',
    name: 'Marketing',
    description: 'Demand generation, brand and the enquiry pipeline.',
    color: '#7B3FA0',
    children: [
      { slug: 'digital-marketing', name: 'Digital & Performance', description: 'Google, Meta, portals, landing pages, lead cost.' },
      { slug: 'brand-creative', name: 'Brand & Creative', description: 'Collateral, renders, walkthroughs, site branding.' },
      { slug: 'events-activations', name: 'Events & Activations', description: 'Launches, expos, society activations, broker meets.' },
    ],
  },
  {
    slug: 'land-bd',
    name: 'Land & Business Development',
    description: 'Finding, evaluating and tying up the next site.',
    color: '#2E7D32',
    children: [
      { slug: 'land-acquisition', name: 'Land Acquisition', description: 'Sourcing, feasibility and negotiation.' },
      { slug: 'joint-development', name: 'Joint Development / JV', description: 'JDA structuring, area sharing, landowner relations.' },
      { slug: 'liaison-approvals', name: 'Liaison & Approvals', description: 'BBMP, BDA, BESCOM, BWSSB, fire and pollution clearances.' },
    ],
  },
  {
    slug: 'design',
    name: 'Design & Planning',
    description: 'What gets built, drawn and specified before work starts.',
    color: '#00838F',
    children: [
      { slug: 'architecture', name: 'Architecture', description: 'Concept, GFC drawings, consultant coordination.' },
      { slug: 'structural-design', name: 'Structural Design', description: 'Structural drawings and consultant sign-off.' },
      { slug: 'mep-design', name: 'MEP Design', description: 'Mechanical, electrical, plumbing, HVAC, firefighting.' },
      { slug: 'planning-estimation', name: 'Planning & Estimation', description: 'BOQs, quantity take-offs, cost budgets, tender drawings.' },
    ],
  },
  {
    slug: 'projects',
    name: 'Projects & Execution',
    description: 'The site. Everything that turns drawings into a building.',
    color: '#E65100',
    children: [
      { slug: 'site-execution', name: 'Site Execution', description: 'Day-to-day construction, labour and subcontractor control.' },
      { slug: 'quality-qaqc', name: 'Quality (QA/QC)', description: 'Material testing, workmanship checks, snag prevention.' },
      { slug: 'safety-ehs', name: 'Safety (EHS)', description: 'Site safety, incident reporting, statutory EHS compliance.' },
      { slug: 'contracts-billing', name: 'Contracts & Billing', description: 'Work orders, RA bills, subcontractor certification.' },
      { slug: 'site-stores', name: 'Site Stores', description: 'Material receipt, issue registers, stock at site.' },
    ],
  },
  {
    slug: 'procurement',
    name: 'Procurement',
    description: 'Buying materials and services at the right price and time.',
    color: '#5D4037',
    children: [
      { slug: 'purchase', name: 'Purchase', description: 'Purchase orders, rate comparison, delivery follow-up.' },
      { slug: 'vendor-management', name: 'Vendor Management', description: 'Empanelment, evaluation, payment terms.' },
      { slug: 'central-stores', name: 'Central Stores', description: 'Central inventory, reorder levels, stock reconciliation.' },
    ],
  },
  {
    slug: 'finance',
    name: 'Finance & Accounts',
    description: 'Money in, money out, and proving both to anyone who asks.',
    color: '#1565C0',
    children: [
      { slug: 'accounts', name: 'Accounts', description: 'Books, vendor bills, day-to-day bookkeeping.' },
      { slug: 'collections', name: 'Collections', description: 'Demand notices, receivables, overdue interest.' },
      { slug: 'taxation-gst', name: 'Taxation & GST', description: 'GST returns, TDS, income tax, assessments.' },
      { slug: 'treasury-banking', name: 'Treasury & Banking', description: 'Cash flow, project loans, escrow, bank relationships.' },
      { slug: 'internal-audit', name: 'Internal Audit', description: 'Controls, cost audit, statutory audit support.' },
    ],
  },
  {
    slug: 'legal',
    name: 'Legal & Compliance',
    description: 'Title, statute and every document that binds the company.',
    color: '#4527A0',
    children: [
      { slug: 'title-due-diligence', name: 'Title & Due Diligence', description: 'Title search, encumbrance, legal opinion on land.' },
      { slug: 'rera-compliance', name: 'RERA Compliance', description: 'Registration, quarterly updates, statutory disclosures.' },
      { slug: 'documentation-registration', name: 'Documentation & Registration', description: 'Agreements, sale deeds, stamp duty, sub-registrar work.' },
      { slug: 'litigation', name: 'Litigation', description: 'Disputes, notices, consumer and civil matters.' },
    ],
  },
  {
    slug: 'customer-experience',
    name: 'Customer Experience',
    description: 'Everything after the booking, until well past possession.',
    color: '#00695C',
    children: [
      { slug: 'post-sales', name: 'Post-Sales / CRM', description: 'Payment schedules, buyer queries, documentation.' },
      { slug: 'handover-possession', name: 'Handover & Possession', description: 'Fit-out checks, possession letters, key handover.' },
      { slug: 'snagging-warranty', name: 'Snagging & Warranty', description: 'Defect tickets, warranty repairs, contractor callbacks.' },
      { slug: 'facility-management', name: 'Facility Management', description: 'Maintenance, association handover, common areas.' },
    ],
  },
  {
    slug: 'leasing',
    name: 'Leasing & Property Management',
    description: 'Rental inventory, tenants and lease administration.',
    color: '#AD1457',
    children: [
      { slug: 'leasing-desk', name: 'Leasing Desk', description: 'Tenant sourcing, rent negotiation, lease renewals.' },
      { slug: 'lease-administration', name: 'Lease Administration', description: 'Rent rolls, escalations, deposits, exits.' },
    ],
  },
  {
    slug: 'hr-admin',
    name: 'HR & Administration',
    description: 'People, payroll and the running of the office.',
    color: '#6A1B9A',
    children: [
      { slug: 'recruitment', name: 'Recruitment', description: 'Hiring, onboarding, offer management.' },
      { slug: 'payroll-compliance', name: 'Payroll & Compliance', description: 'Salaries, PF, ESI, labour law compliance.' },
      { slug: 'training', name: 'Training & Development', description: 'Sales training, SOP rollout, certification.' },
      { slug: 'administration', name: 'Administration', description: 'Office upkeep, travel, vehicles, housekeeping.' },
    ],
  },
  {
    slug: 'it-systems',
    name: 'IT & Systems',
    description: 'The CRM, the data and everything that runs on a screen.',
    color: '#37474F',
    children: [
      { slug: 'it-support', name: 'IT Support', description: 'Devices, accounts, access, day-to-day support.' },
      { slug: 'data-mis', name: 'Data & MIS', description: 'Reports, dashboards, management information.' },
    ],
  },
];

/** Flat list of every slug in the catalogue — divisions first, then teams. */
export function allCatalogueSlugs(): string[] {
  return DEPARTMENT_CATALOGUE.flatMap((d) => [d.slug, ...d.children.map((c) => c.slug)]);
}
