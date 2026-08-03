import type { RoleName } from '@prisma/client';
import { ALL_PERMISSION_KEYS, type PermissionKey } from './permissions';

/**
 * Default role → permission mapping. `*` grants everything; `module.*` grants
 * all keys within a module. These are seeded as RolePermission rows and can be
 * overridden per-role or per-user at runtime via the Admin panel.
 */
export const ROLE_DEFAULTS: Record<RoleName, string[]> = {
  SUPER_ADMIN: ['*'],
  ADMIN: [
    'dashboard.view', 'task.*', 'lead.*', 'booking.*', 'document.*',
    // Deliberately NOT 'billing.*' — that wildcard would sweep in the finance
    // ledger keys. Expenses and payments are appointed, never inherited.
    'billing.view', 'billing.invoice.manage', 'billing.po.manage',
    'billing.bill.manage', 'billing.approve',
    'material.*', 'email.*', 'calendar.*', 'report.*',
    'admin.user.*', 'admin.department.manage', 'admin.role.manage',
    'admin.project.manage', 'admin.setting.manage', 'admin.notification.manage',
    'audit.view', 'audit.export', 'marketing.*', 'lease.*', 'architecture.*',

    // ── The forty-two that belonged to nobody ────────────────────────────────
    //
    // These keys were defined, used to guard ~45 screens, and granted to no
    // role at all — so every one of those screens redirected everybody except
    // the Super Admin to /forbidden. Land, treasury, programme, quality,
    // procurement, governance, the whole of the finance ledger: an owner
    // signing in as Super Admin saw a complete product and nobody else could
    // reach half of it, which is what "there are so many sections where I
    // cannot add data" actually was.
    //
    // An Admin is the person who runs the company in this product, so an Admin
    // gets them. They stay OFF the lower roles, where they should be appointed
    // deliberately rather than inherited.
    'finance.ledger.view', 'finance.ledger.manage',
    'land.*', 'treasury.*', 'programme.*', 'quality.*', 'capital.*',
    'pricing.*', 'feasibility.*', 'statutory.*', 'procurement.*',
    'governance.*', 'secops.*', 'knowledge.*', 'esg.*', 'variations.*',
    'people.*', 'association.*', 'workrequest.*', 'telemetry.*', 'data.view',
    // NOT 'finance.access.manage' — who may see the books is a Super Admin
    // decision, and an Admin able to appoint themselves is not a control.
  ],
  DEPARTMENT_HEAD: [
    'dashboard.view', 'task.*', 'lead.view', 'lead.update', 'booking.view',
    'document.*', 'billing.view', 'billing.approve', 'material.*', 'email.send',
    'calendar.*', 'report.view', 'report.export', 'admin.user.view', 'audit.view',
    'marketing.view', 'marketing.manage', 'marketing.approve', 'lease.view', 'lease.manage',
    'architecture.view', 'architecture.manage',
    // The operational registers a department head is expected to keep.
    'programme.view', 'programme.manage', 'quality.view', 'quality.manage',
    'procurement.view', 'procurement.manage', 'statutory.view',
    'governance.view', 'knowledge.view', 'knowledge.manage', 'esg.view',
    'variations.view', 'variations.manage', 'people.view', 'land.view',
    'workrequest.view', 'workrequest.create', 'workrequest.manage', 'data.view',
  ],
  MANAGER: [
    'dashboard.view', 'task.view', 'task.create', 'task.update', 'task.assign',
    'task.comment', 'lead.view', 'lead.create', 'lead.update', 'lead.assign',
    'booking.view', 'booking.manage', 'document.view', 'document.create',
    'document.update', 'document.download', 'billing.view', 'material.view',
    'material.create', 'material.approve', 'email.send', 'calendar.*',
    'report.view', 'report.export',
    'marketing.view', 'marketing.manage', 'lease.view', 'lease.manage',
    'architecture.view', 'architecture.manage',
    'programme.view', 'programme.manage', 'quality.view', 'quality.manage',
    'procurement.view', 'knowledge.view', 'esg.view', 'variations.view',
    'workrequest.view', 'workrequest.create',
  ],
  EXECUTIVE: [
    'dashboard.view', 'task.view', 'task.create', 'task.update', 'task.comment',
    'lead.view', 'lead.create', 'lead.update', 'booking.view', 'document.view',
    'document.create', 'document.update', 'document.download', 'material.view',
    'material.create', 'email.send', 'calendar.view', 'calendar.manage',
    'report.view',
    'marketing.view', 'marketing.manage', 'lease.view', 'architecture.view', 'architecture.manage',
    'programme.view', 'quality.view', 'quality.manage', 'workrequest.view', 'workrequest.create',
  ],
  EMPLOYEE: [
    'dashboard.view', 'task.view', 'task.update', 'task.comment', 'document.view',
    'document.download', 'material.view', 'material.create', 'calendar.view',
    'marketing.view', 'lease.view', 'architecture.view',
    'quality.view', 'workrequest.view', 'workrequest.create',
  ],
  READ_ONLY: [
    'dashboard.view', 'task.view', 'lead.view', 'booking.view', 'document.view',
    'billing.view', 'material.view', 'calendar.view', 'report.view',
    'marketing.view', 'lease.view', 'architecture.view',
  ],
  // GUEST = sealed preview account. No data permissions at all: the app layout
  // confines a guest to the sample-data showcase (/preview) and every server
  // action is refused for this role. Zero here means that even if the route
  // guard were ever bypassed, no real-data page could render.
  GUEST: [],
};

/** Expand wildcard patterns to concrete permission keys. */
export function expandRolePermissions(patterns: string[]): PermissionKey[] {
  const set = new Set<PermissionKey>();
  for (const pattern of patterns) {
    if (pattern === '*') {
      ALL_PERMISSION_KEYS.forEach((k) => set.add(k));
      continue;
    }
    if (pattern.endsWith('.*')) {
      const prefix = pattern.slice(0, -1); // keep trailing dot
      ALL_PERMISSION_KEYS.filter((k) => k.startsWith(prefix)).forEach((k) => set.add(k));
      continue;
    }
    if ((ALL_PERMISSION_KEYS as string[]).includes(pattern)) set.add(pattern as PermissionKey);
  }
  return [...set];
}

export const ROLE_LABELS: Record<RoleName, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  DEPARTMENT_HEAD: 'Department Head',
  MANAGER: 'Manager',
  EXECUTIVE: 'Executive',
  EMPLOYEE: 'Employee',
  READ_ONLY: 'Read Only',
  GUEST: 'Guest',
};

export const ROLE_RANK: Record<RoleName, number> = {
  SUPER_ADMIN: 100, ADMIN: 90, DEPARTMENT_HEAD: 70, MANAGER: 60,
  EXECUTIVE: 40, EMPLOYEE: 30, READ_ONLY: 20, GUEST: 10,
};
