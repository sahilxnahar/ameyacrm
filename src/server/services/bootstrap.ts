import 'server-only';
import bcrypt from 'bcryptjs';
import type { RoleName } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { PERMISSIONS, ALL_PERMISSION_KEYS, moduleOf } from '@/lib/rbac/permissions';
import { ROLE_DEFAULTS, expandRolePermissions } from '@/lib/rbac/roles';

const DEPARTMENTS = [
  'Architecture', 'Billing', 'Management', 'Marketing', 'Sales', 'NRI', 'Lease',
  'Administration', 'Site Operations', 'Legal', 'Accounts', 'Human Resources', 'Document Control',
];
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export interface BootstrapResult {
  created: boolean;
  userCount: number;
  credentials?: { username: string; email: string; password: string };
}

/**
 * Idempotent, runtime-safe first-run seed (no tsx needed). Sets up permissions,
 * role mappings, the 13 departments, the flagship project, task labels, the
 * material-request email template, a root folder, baseline settings, and the
 * initial Super Admin. Safe to call repeatedly — only creates the admin once.
 */
export async function bootstrap(): Promise<BootstrapResult> {
  const existing = await prisma.user.count();
  if (existing > 0) return { created: false, userCount: existing };

  // Permissions
  for (const key of ALL_PERMISSION_KEYS) {
    await prisma.permission.upsert({ where: { key }, update: { description: PERMISSIONS[key], module: moduleOf(key) }, create: { key, description: PERMISSIONS[key], module: moduleOf(key) } });
  }
  const permByKey = new Map((await prisma.permission.findMany()).map((p) => [p.key, p.id]));

  // Role → permission mappings
  for (const role of Object.keys(ROLE_DEFAULTS) as RoleName[]) {
    const keys = role === 'SUPER_ADMIN' ? [] : expandRolePermissions(ROLE_DEFAULTS[role]);
    for (const key of keys) {
      const pid = permByKey.get(key);
      if (!pid) continue;
      await prisma.rolePermission.upsert({ where: { role_permissionId: { role, permissionId: pid } }, update: { effect: 'ALLOW' }, create: { role, permissionId: pid, effect: 'ALLOW' } });
    }
  }

  // Departments
  for (const name of DEPARTMENTS) {
    await prisma.department.upsert({ where: { slug: slugify(name) }, update: {}, create: { name, slug: slugify(name) } });
  }
  const mgmt = await prisma.department.findUnique({ where: { slug: 'management' } });

  // Project + labels + template + root folder + settings
  await prisma.project.upsert({ where: { code: 'AH-01' }, update: {}, create: { name: 'Ameya Heights', code: 'AH-01', description: 'Premium residential development — flagship project.', city: 'Bangalore' } });
  for (const l of [
    { name: 'Urgent', color: '#9B111E' }, { name: 'Client', color: '#A07D34' }, { name: 'Site', color: '#2E7D32' },
    { name: 'Design', color: '#1B2A4A' }, { name: 'Internal', color: '#8C6E2C' },
  ]) await prisma.taskLabel.upsert({ where: { name: l.name }, update: {}, create: l });
  await prisma.emailTemplate.upsert({
    where: { key: 'material_request' }, update: {},
    create: { key: 'material_request', name: 'Material Request', subject: '[{{priority}}] Material Request {{reference}} — {{project}}', body: 'Dear {{recipient}},\n\nPlease arrange the following materials for {{project}} ({{department}}), required by {{neededBy}}:\n\n{{items}}\n\nRaised by: {{requester}}\nNotes: {{notes}}\n\nRegards,\nAmeya Heights CRM' },
  });
  await prisma.folder.upsert({ where: { id: 'root-ah' }, update: {}, create: { id: 'root-ah', name: 'Ameya Heights', visibility: 'ORGANIZATION', path: '/' } });
  for (const [key, value] of [['branding.displayName', 'Ameya Heights'], ['branding.tagline', 'Building Spaces. Shaping Legacies.'], ['security.passwordExpiryDays', 90]] as const) {
    await prisma.setting.upsert({ where: { key }, update: { value: value as object }, create: { key, value: value as object } });
  }

  // Super Admin
  const username = process.env.SETUP_USERNAME || 'superadmin';
  const email = (process.env.SETUP_EMAIL || 'admin@naharheights.com').toLowerCase();
  const password = process.env.SETUP_PASSWORD || 'Ameya@Heights2026';
  await prisma.user.create({
    data: {
      name: process.env.SETUP_NAME || 'Sahil Nahar', username, email, role: 'SUPER_ADMIN', status: 'ACTIVE',
      passwordHash: await bcrypt.hash(password, 12), mustChangePassword: true, joiningDate: new Date(),
      departmentId: mgmt?.id, designation: 'Founder',
    },
  });

  return { created: true, userCount: 1, credentials: { username, email, password } };
}
