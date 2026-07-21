/**
 * RBAC permission catalog — single source of truth.
 * Keys follow `<module>.<action>` (or `<module>.<sub>.<action>`).
 * The seed inserts every key below into the Permission table so admins can
 * re-map them to roles/users at runtime (true configurable RBAC).
 */
export const PERMISSIONS = {
  // Cross-cutting
  'dashboard.view': 'View personal dashboard',

  // Tasks
  'task.view': 'View tasks',
  'task.create': 'Create tasks',
  'task.update': 'Edit tasks',
  'task.delete': 'Delete tasks',
  'task.assign': 'Assign tasks to users',
  'task.comment': 'Comment on tasks',

  // Sales / Leads / Bookings
  'lead.view': 'View leads',
  'lead.create': 'Create leads',
  'lead.update': 'Edit leads',
  'lead.delete': 'Delete leads',
  'lead.assign': 'Assign lead owner',
  'booking.view': 'View bookings',
  'booking.manage': 'Create / edit bookings & payments',

  // Documents
  'document.view': 'View documents & folders',
  'document.create': 'Upload documents / create folders',
  'document.update': 'Edit documents / new versions',
  'document.delete': 'Delete documents / folders',
  'document.manage': 'Manage folder permissions',
  'document.download': 'Download documents',

  // Billing
  'billing.view': 'View billing records',
  'billing.invoice.manage': 'Create / edit invoices',
  'billing.po.manage': 'Create / edit purchase orders',
  'billing.bill.manage': 'Create / edit vendor bills',
  'billing.approve': 'Approve billing documents',

  // Finance ledger — expenses, payments made, cash book. Deliberately held by
  // nobody in the role defaults: it is granted person by person in
  // Admin > Finance Access, and Super Admins have it via '*'.
  'finance.ledger.view': 'See expenses, payments made and the cash book',
  'finance.ledger.manage': 'Record and cancel payments, and enter UTRs',
  'finance.access.manage': 'Appoint who may see the money',

  // Material requests & email
  'material.view': 'View material requests',
  'material.create': 'Raise material requests',
  'material.approve': 'Approve material requests',
  'email.send': 'Send internal / structured emails',
  'email.template.manage': 'Manage email templates',

  // Calendar
  'calendar.view': 'View calendar',
  'calendar.manage': 'Create / edit events',

  // Reports
  'report.view': 'View reports',
  'report.export': 'Export reports (Excel/CSV/PDF)',

  // Administration
  'admin.user.view': 'View users',
  'admin.user.manage': 'Create / edit / disable users',
  'admin.department.manage': 'Create / edit departments',
  'admin.role.manage': 'Configure roles & permissions',
  'admin.project.manage': 'Create / edit projects',
  'admin.setting.manage': 'Manage system settings & branding',
  'admin.notification.manage': 'Manage notification config',

  // Audit
  'audit.view': 'View audit trail',
  'audit.export': 'Export audit logs',
  // Marketing
  'marketing.view': 'View marketing campaigns & assets',
  'marketing.manage': 'Create / edit campaigns, assets, social posts',
  'marketing.approve': 'Approve marketing assets & campaigns',

  // Lease
  'lease.view': 'View tenants & leases',
  'lease.manage': 'Create / edit leases, rent schedule, maintenance',

  // Architecture
  'architecture.view': 'View drawings, RFIs & issues',
  'architecture.manage': 'Manage drawings, RFIs, consultants & issues',

  // Land, title & approvals (batch 13)
  'land.view': 'View land parcels, title chains, approvals & litigation',
  'land.manage': 'Manage parcels, title documents, approvals, liaison & litigation',

  // Cash flow & treasury (batch 4)
  'treasury.view': 'View bank position, reconciliation, cash forecast & loans',
  'treasury.manage': 'Manage bank accounts, import statements, reconcile & record loans',

  // Data quality & dictionary (batch 24)
  'data.view': 'View data-quality scores, duplicate candidates & the data dictionary',

  // Programme & progress (batch 5)
  'programme.view': 'View the construction programme, progress, earned value & delays',
  'programme.manage': 'Manage activities, dependencies, progress, BOQ & the delay register',

  // Quality & safety (batch 14)
  'quality.view': 'View inspections, hold points, non-conformances, safety & permits',
  'quality.manage': 'Manage inspections, NCRs, safety records & work permits',

  // Capital, investors & escrow (batch 16)
  'capital.view': 'View the capital stack, investors, RERA escrow & loan covenants',
  'capital.manage': 'Manage investors, capital stack, escrow movements & covenants',

  // Sales pricing & commission (batch 7)
  'pricing.view': 'View unit pricing and broker commissions',
  'pricing.manage': 'Set unit pricing and record broker commissions',

} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

export const ALL_PERMISSION_KEYS = Object.keys(PERMISSIONS) as PermissionKey[];

export function moduleOf(key: string): string {
  return key.split('.')[0] ?? 'general';
}
