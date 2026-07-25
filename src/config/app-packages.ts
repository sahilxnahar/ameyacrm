// Client-safe catalogue of installable App Packages (v15.27).
// A package bundles several artifacts (automations, custom fields, saved views,
// email templates, connectors) into one unit you install — or author yourself
// and share as JSON. This is the extensibility layer: reshape the CRM without code.

export type PackageItemKind = 'automation' | 'fields' | 'view' | 'template' | 'connector';

export interface PackageItem {
  kind: PackageItemKind;
  payload: Record<string, unknown>;
}

export interface AppPackage {
  id: string;
  name: string;
  publisher: string;
  category: string;
  description: string;
  items: PackageItem[];
}

export const APP_PACKAGES: AppPackage[] = [
  {
    id: 'nri-sales-kit',
    name: 'NRI Sales Kit',
    publisher: 'Ameya',
    category: 'Sales',
    description: 'Everything to handle overseas buyers: routing, time-zone-aware follow-up, and the extra fields an NRI deal needs.',
    items: [
      { kind: 'fields', payload: { entity: 'Lead', fields: [
        { key: 'nri_country', label: 'Country of residence', type: 'text' },
        { key: 'nri_timezone', label: 'Preferred call time (their zone)', type: 'text' },
        { key: 'nri_repatriation', label: 'Needs repatriable payment', type: 'boolean' },
      ] } },
      { kind: 'automation', payload: { name: 'NRI — call in their time zone', description: 'When an NRI enquiry arrives, raise a follow-up task noting the time zone.', trigger: 'LEAD_CREATED', conditions: [{ field: 'source', op: 'eq', value: 'NRI_DESK' }], actions: [{ type: 'CREATE_TASK', params: { title: 'Call the NRI enquiry (mind the time zone)', dueInDays: 1, priority: 'HIGH' } }] } },
      { kind: 'view', payload: { name: 'NRI enquiries', entity: 'Lead', filters: { source: 'NRI_DESK' } } },
    ],
  },
  {
    id: 'collections-booster',
    name: 'Collections Booster',
    publisher: 'Ameya',
    category: 'Billing',
    description: 'Chase dues on the day they fall, escalate the stubborn ones, and track promise-to-pay.',
    items: [
      { kind: 'fields', payload: { entity: 'Lead', fields: [{ key: 'promise_to_pay', label: 'Promised payment date', type: 'date' }] } },
      { kind: 'automation', payload: { name: 'Chase instalments due today', description: 'A daily task listing instalments due today.', trigger: 'SCHEDULE', actions: [{ type: 'CREATE_TASK', params: { title: 'Chase instalments falling due today', dueInDays: 0, priority: 'HIGH' } }] } },
      { kind: 'automation', payload: { name: 'Escalate dues over 30 days', description: 'Notify a manager about long-overdue amounts.', trigger: 'SCHEDULE', actions: [{ type: 'NOTIFY_ROLE', params: { role: 'MANAGER', title: 'Review dues overdue beyond 30 days' } }] } },
    ],
  },
  {
    id: 'channel-partner-pack',
    name: 'Channel Partner Pack',
    publisher: 'Ameya',
    category: 'Partners',
    description: 'Onboard brokers cleanly with the compliance fields and the referral thank-you flow.',
    items: [
      { kind: 'fields', payload: { entity: 'Lead', fields: [
        { key: 'cp_firm', label: 'Referring firm', type: 'text' },
        { key: 'cp_rera', label: 'Partner RERA no.', type: 'text' },
      ] } },
      { kind: 'automation', payload: { name: 'Thank the referrer on a win', description: 'When a referred enquiry is won, raise a thank-you task.', trigger: 'LEAD_STAGE_CHANGED', matchAll: true, conditions: [{ field: 'status', op: 'eq', value: 'WON' }, { field: 'source', op: 'eq', value: 'REFERRAL' }], actions: [{ type: 'CREATE_TASK', params: { title: 'Thank and reward the referrer', dueInDays: 2, priority: 'MEDIUM' } }] } },
    ],
  },
  {
    id: 'site-safety-pack',
    name: 'Site Safety Pack',
    publisher: 'Ameya',
    category: 'Site Operations',
    description: 'A daily safety walk and the fields to record zone and incident risk.',
    items: [
      { kind: 'fields', payload: { entity: 'Task', fields: [{ key: 'safety_zone', label: 'Site zone', type: 'text' }] } },
      { kind: 'automation', payload: { name: 'Daily site safety walk', description: 'A recurring task for the pre-work safety walk.', trigger: 'SCHEDULE', actions: [{ type: 'CREATE_TASK', params: { title: 'Complete the daily site safety walk', dueInDays: 0, priority: 'HIGH' } }] } },
    ],
  },
  {
    id: 'compliance-starter',
    name: 'Compliance Starter',
    publisher: 'Ameya',
    category: 'Legal',
    description: 'Never miss a RERA quarterly filing, and connect the tools your CA uses.',
    items: [
      { kind: 'automation', payload: { name: 'RERA quarterly filing reminder', description: 'A recurring reminder to file the RERA quarterly update.', trigger: 'SCHEDULE', actions: [{ type: 'NOTIFY_ROLE', params: { role: 'DEPARTMENT_HEAD', title: 'RERA quarterly update is due — file it' } }, { type: 'CREATE_TASK', params: { title: 'File the RERA quarterly project update', dueInDays: 10, priority: 'HIGH' } }] } },
      { kind: 'connector', payload: { slug: 'cleartax' } },
      { kind: 'connector', payload: { slug: 'tally-prime' } },
    ],
  },
];

export const APP_PACKAGE_CATEGORIES = [...new Set(APP_PACKAGES.map((p) => p.category))];
const BY_ID = new Map(APP_PACKAGES.map((p) => [p.id, p]));
export function appPackageById(id: string): AppPackage | undefined { return BY_ID.get(id); }

/** Count the concrete artifacts a package will create, for the UI. */
export function packageSummary(pkg: AppPackage): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of pkg.items) {
    const n = item.kind === 'fields' ? ((item.payload.fields as unknown[]) ?? []).length : 1;
    out[item.kind] = (out[item.kind] ?? 0) + n;
  }
  return out;
}
