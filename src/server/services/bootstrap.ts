import 'server-only';
import bcrypt from 'bcryptjs';
import { PrismaClient, type RoleName } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { PERMISSIONS, ALL_PERMISSION_KEYS, moduleOf } from '@/lib/rbac/permissions';
import { ROLE_DEFAULTS, expandRolePermissions } from '@/lib/rbac/roles';
import { INIT_SCHEMA_SQL_B64 } from './init-schema-sql';
import { splitSql } from '@/lib/db/split-sql';

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
/**
 * Create the database schema at runtime if it doesn't exist yet — so the app can
 * be deployed to a serverless host with no build-time DB access and no terminal.
 * Idempotent: runs only when the "User" table is missing; tolerates re-runs.
 */
export async function ensureSchema(): Promise<boolean> {
  // Use the UNPOOLED/direct connection for DDL — pooled (pgbouncer) connections
  // can mishandle bulk CREATE TABLE. Falls back to DATABASE_URL if unpooled isn't set.
  const directUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  const client = new PrismaClient({ datasourceUrl: directUrl });
  try {
    const rows = await client.$queryRawUnsafe<Array<{ t: string | null }>>(
      `SELECT to_regclass('public."User"')::text AS t`,
    );
    if (rows?.[0]?.t) return false; // schema already present

    const sql = Buffer.from(INIT_SCHEMA_SQL_B64, 'base64').toString('utf8');
    for (const stmt of splitSql(sql)) {
      try {
        await client.$executeRawUnsafe(stmt);
      } catch {
        /* tolerate "already exists" on partial re-runs */
      }
    }
    return true;
  } finally {
    await client.$disconnect();
  }
}

export async function bootstrap(): Promise<BootstrapResult> {
  await ensureSchema();
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
    await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
  }

  // Super Admin
  const username = process.env.SETUP_USERNAME || 'superadmin';
  const email = (process.env.SETUP_EMAIL || 'admin@ameyaheights.com').toLowerCase();
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


export interface RepairResult {
  ran: number;
  failed: number;
  database: string;
  usedDirect: boolean;
  errors: string[];
}

/**
 * Bring the database up to the shape this build expects, from inside the app.
 *
 * ensureSchema() only runs on a virgin database, so an existing install that
 * falls behind stays behind — and pasting SQL by hand goes wrong in ways that
 * are invisible: the wrong Neon branch, an editor that stops at the first
 * error, a half-selected file. Running it through the app's own connection
 * removes every one of those, because it is by definition the right database.
 *
 * Every statement is idempotent, so this is safe to run as often as you like.
 */
export async function repairSchema(): Promise<RepairResult> {
  const directUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  const usedDirect = Boolean(process.env.DATABASE_URL_UNPOOLED);
  const client = new PrismaClient({ datasourceUrl: directUrl });

  const errors: string[] = [];
  let ran = 0;
  let failed = 0;
  let database = 'unknown';

  try {
    const who = await client.$queryRawUnsafe<Array<{ db: string }>>('SELECT current_database() AS db');
    database = who?.[0]?.db ?? 'unknown';

    const sql = Buffer.from(INIT_SCHEMA_SQL_B64, 'base64').toString('utf8');

    for (const stmt of splitSql(sql)) {
      try {
        await client.$executeRawUnsafe(stmt);
        ran++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        // "already exists" is the expected outcome for most of these.
        if (/already exists|duplicate/i.test(msg)) { ran++; continue; }
        failed++;
        // One distinct message per kind of failure. Twenty copies of the same
        // error tells you nothing that one copy does not.
        const line = `${stmt.slice(0, 50).replace(/\s+/g, ' ')}… → ${msg.slice(0, 140)}`;
        if (errors.length < 6 && !errors.some((e) => e.slice(-60) === line.slice(-60))) errors.push(line);
      }
    }
    return { ran, failed, database, usedDirect, errors };
  } finally {
    await client.$disconnect().catch(() => undefined);
  }
}
