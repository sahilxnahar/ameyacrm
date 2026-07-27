// Pure, testable normaliser that maps a portal's inbound payload (99acres,
// MagicBricks, Housing, NoBroker, …) to the CRM's lead fields. Each portal names
// fields differently, so we try a broad set of candidates case-insensitively.

export interface NormalizedLead {
  name: string;
  phone: string | null;
  email: string | null;
  requirement: string | null;
  budget: number | null;
  projectCode: string | null;
}

const CANDIDATES: Record<keyof Omit<NormalizedLead, 'budget'>, string[]> = {
  name: ['name', 'full_name', 'fullname', 'customername', 'customer_name', 'lead_name', 'contactname'],
  phone: ['phone', 'mobile', 'mobileno', 'mobile_no', 'contact', 'contactno', 'phone_number', 'phonenumber'],
  email: ['email', 'emailid', 'email_id', 'emailaddress'],
  requirement: ['requirement', 'message', 'query', 'comments', 'remarks', 'note', 'notes', 'enquiry', 'description'],
  projectCode: ['projectcode', 'project_code', 'project', 'projectname', 'project_name', 'campaign'],
};
const BUDGET_KEYS = ['budget', 'budgetmax', 'budget_max', 'maxbudget', 'price', 'budget_range'];

function lookup(body: Record<string, unknown>, keys: string[]): string | null {
  const lower: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) lower[k.toLowerCase().replace(/[\s-]/g, '_').replace(/_/g, '')] = v;
  for (const cand of keys) {
    const norm = cand.toLowerCase().replace(/[\s_-]/g, '');
    if (lower[norm] != null && String(lower[norm]).trim() !== '') return String(lower[norm]).trim();
  }
  return null;
}

export function normalizeLeadPayload(body: Record<string, unknown>): NormalizedLead {
  const budgetRaw = lookup(body, BUDGET_KEYS);
  const budgetNum = budgetRaw ? Number(String(budgetRaw).replace(/[^0-9.]/g, '')) : NaN;
  return {
    name: lookup(body, CANDIDATES.name) ?? '',
    phone: lookup(body, CANDIDATES.phone),
    email: lookup(body, CANDIDATES.email)?.toLowerCase() ?? null,
    requirement: lookup(body, CANDIDATES.requirement),
    budget: Number.isFinite(budgetNum) && budgetNum > 0 ? budgetNum : null,
    projectCode: lookup(body, CANDIDATES.projectCode),
  };
}

/** Directory slugs that push leads in. Their inbound endpoint is /api/connectors/leads/<slug>. */
export const LEAD_CONNECTOR_SLUGS = ['99acres', 'magicbricks', 'housing-com', 'nobroker', 'square-yards', 'sulekha', 'commonfloor', 'proptiger'];
