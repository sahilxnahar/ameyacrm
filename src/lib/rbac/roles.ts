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
  ],
  DEPARTMENT_HEAD: [
    'dashboard.view', 'task.*', 'lead.view', 'lead.update', 'booking.view',
    'document.*', 'billing.view', 'billing.approve', 'material.*', 'email.send',
    'calendar.*', 'report.view', 'report.export', 'admin.user.view', 'audit.view',
    'marketing.view', 'marketing.manage', 'marketing.approve', 'lease.view', 'lease.manage',
    'architecture.view', 'architecture.manage',
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
  ],
  EXECUTIVE: [
    'dashboard.view', 'task.view', 'task.create', 'task.update', 'task.comment',
    'lead.view', 'lead.create', 'lead.update', 'booking.view', 'document.view',
    'document.create', 'document.update', 'document.download', 'material.view',
    'material.create', 'email.send', 'calendar.view', 'calendar.manage',
    'report.view',
    'marketing.view', 'marketing.manage', 'lease.view', 'architecture.view', 'architecture.manage',
  ],
  EMPLOYEE: [
    'dashboard.view', 'task.view', 'task.update', 'task.comment', 'document.view',
    'document.download', 'material.view', 'material.create', 'calendar.view',
    'marketing.view', 'lease.view', 'architecture.view',
  ],
  READ_ONLY: [
    'dashboard.view', 'task.view', 'lead.view', 'booking.view', 'document.view',
    'billing.view', 'material.view', 'calendar.view', 'report.view',
    'marketing.view', 'lease.view', 'architecture.view',
  ],
  GUEST: ['dashboard.view', 'task.view', 'calendar.view'],
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
