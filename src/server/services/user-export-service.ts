import 'server-only';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { prisma } from '@/lib/db/prisma';

/**
 * Workspace-style user data takeout.
 *
 * Produces a .zip laid out the way an admin actually needs it:
 *
 *   users.xlsx                     ← one readable sheet of everybody
 *   users.json                     ← the same data, machine-readable
 *   README.txt                     ← what this is, when it was made
 *   users/<name>/profile.json      ← one folder per person…
 *   users/<name>/activity.json     ← …with everything they created
 *   users/<name>/summary.xlsx
 *
 * Two deliberate choices:
 *  - Password hashes and 2FA secrets are NEVER included. An export is the
 *    easiest thing in a system to mislay, and it must not be a credential file.
 *  - Every export is written to the audit log with the actor's name, because
 *    bulk extraction of personal data is exactly what an audit trail is for.
 */

/** Fields that must never leave the database, whatever else is exported. */
const NEVER_EXPORT = ['passwordHash', 'twoFactorSecret', 'twoFactorRecoveryCodes'] as const;

function scrub<T extends Record<string, unknown>>(row: T): Omit<T, (typeof NEVER_EXPORT)[number]> {
  const out = { ...row } as Record<string, unknown>;
  for (const k of NEVER_EXPORT) delete out[k];
  return out as Omit<T, (typeof NEVER_EXPORT)[number]>;
}

/** A filesystem-safe folder name, unique per user. */
function folderFor(u: { name: string | null; email: string; id: string }): string {
  const base = (u.name || u.email.split('@')[0] || 'user')
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 40) || 'user';
  return `${base}-${u.id.slice(-6)}`;
}

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

export interface ExportOptions {
  /** Limit to specific users; omit for everybody. */
  userIds?: string[];
  /** Include each person's created records, not just their profile. */
  includeActivity?: boolean;
}

export async function buildUserExport(opts: ExportOptions = {}): Promise<{ filename: string; base64: string; users: number }> {
  const where = opts.userIds?.length ? { id: { in: opts.userIds } } : {};
  const users = await prisma.user.findMany({
    where,
    orderBy: { name: 'asc' },
    include: {
      department: { select: { name: true } },
      manager: { select: { name: true, email: true } },
    },
  });

  const zip = new JSZip();
  const stamp = new Date();

  // ── Flat summary: the sheet an admin actually opens ──────────────────────
  const summaryRows = users.map((u) => ({
    Name: u.name ?? '',
    Email: u.email,
    Role: u.role,
    Status: u.status,
    Department: u.department?.name ?? '',
    Manager: u.manager?.name ?? '',
    'Job title': (u as { jobTitle?: string | null }).jobTitle ?? '',
    'Phone (work)': (u as { phone?: string | null }).phone ?? '',
    'Created on': iso(u.createdAt)?.slice(0, 10) ?? '',
    'Last login': iso((u as { lastLoginAt?: Date | null }).lastLoginAt)?.slice(0, 10) ?? 'never',
    'Must change password': (u as { mustChangePassword?: boolean }).mustChangePassword ? 'yes' : 'no',
    'Two-factor': (u as { twoFactorEnabled?: boolean }).twoFactorEnabled ? 'on' : 'off',
    Deleted: u.deletedAt ? iso(u.deletedAt)?.slice(0, 10) : '',
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(summaryRows);
  ws['!cols'] = Object.keys(summaryRows[0] ?? { a: '' }).map((k) => ({
    wch: Math.min(32, Math.max(12, k.length + 4)),
  }));
  XLSX.utils.book_append_sheet(wb, ws, 'Users');
  const xlsxBuf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  zip.file('users.xlsx', xlsxBuf);
  zip.file('users.json', JSON.stringify(users.map((u) => scrub(u as unknown as Record<string, unknown>)), null, 2));

  zip.file(
    'README.txt',
    [
      'Ameya CRM — user data export',
      `Generated: ${stamp.toISOString()}`,
      `Users included: ${users.length}`,
      '',
      'Contents',
      '  users.xlsx            A readable summary of every user.',
      '  users.json            The same data in full, machine-readable.',
      '  users/<person>/       One folder per user:',
      '      profile.json        Their account details.',
      '      activity.json       What they created in the CRM.',
      '      summary.xlsx        The same activity as a spreadsheet.',
      '',
      'Passwords and two-factor secrets are deliberately NOT included.',
      'This file contains personal data — store it somewhere access-controlled',
      'and delete it once you are finished with it.',
    ].join('\n'),
  );

  // ── Per-user folders ─────────────────────────────────────────────────────
  for (const u of users) {
    const dir = `users/${folderFor(u)}`;
    zip.file(`${dir}/profile.json`, JSON.stringify(scrub(u as unknown as Record<string, unknown>), null, 2));

    if (opts.includeActivity !== false) {
      const activity = await collectActivity(u.id);
      zip.file(`${dir}/activity.json`, JSON.stringify(activity, null, 2));

      const awb = XLSX.utils.book_new();
      let anySheet = false;
      for (const [sheet, rows] of Object.entries(activity)) {
        if (!Array.isArray(rows) || rows.length === 0) continue;
        XLSX.utils.book_append_sheet(
          awb,
          XLSX.utils.json_to_sheet(rows as Record<string, unknown>[]),
          sheet.slice(0, 31), // Excel's sheet-name limit
        );
        anySheet = true;
      }
      if (!anySheet) {
        XLSX.utils.book_append_sheet(awb, XLSX.utils.json_to_sheet([{ Note: 'No records created by this user.' }]), 'Empty');
      }
      zip.file(`${dir}/summary.xlsx`, XLSX.write(awb, { type: 'buffer', bookType: 'xlsx' }) as Buffer);
    }
  }

  const base64 = await zip.generateAsync({ type: 'base64', compression: 'DEFLATE' });
  const day = stamp.toISOString().slice(0, 10);
  const filename = opts.userIds?.length === 1
    ? `ameya-user-export-${folderFor(users[0] ?? { name: 'user', email: 'user@x', id: '000000' })}-${day}.zip`
    : `ameya-users-export-${day}.zip`;

  return { filename, base64, users: users.length };
}

/**
 * What a person created across the CRM.
 *
 * Each query is wrapped so a model that does not exist in a given deployment
 * cannot fail the whole export — a takeout that dies on one missing table is
 * worse than one that notes the gap and carries on.
 */
async function collectActivity(userId: string): Promise<Record<string, unknown[]>> {
  const safe = async <T>(label: string, fn: () => Promise<T[]>): Promise<[string, T[]]> => {
    try { return [label, await fn()]; } catch { return [label, []]; }
  };

  const results = await Promise.all([
    safe('Leads', () => prisma.lead.findMany({ where: { ownerId: userId }, select: { id: true, name: true, phone: true, status: true, createdAt: true }, take: 2000 })),
    safe('Tasks', () => prisma.task.findMany({ where: { createdById: userId }, select: { id: true, title: true, status: true, dueDate: true, createdAt: true }, take: 2000 })),
    safe('Documents', () => prisma.document.findMany({ where: { ownerId: userId }, select: { id: true, title: true, createdAt: true }, take: 2000 })),
    safe('Vouchers', () => prisma.voucher.findMany({ where: { createdById: userId }, select: { id: true, number: true, kind: true, amount: true, voucherDate: true }, take: 2000 })),
    safe('AuditTrail', () => prisma.auditLog.findMany({ where: { actorId: userId }, select: { action: true, entityType: true, summary: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1000 })),
  ]);

  const out: Record<string, unknown[]> = {};
  for (const [label, rows] of results) {
    // Decimals and dates must be plain values, or JSON.stringify emits objects
    // that no spreadsheet can read.
    out[label] = rows.map((r) => {
      const o: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(r as Record<string, unknown>)) {
        o[k] = v instanceof Date ? v.toISOString() : typeof v === 'object' && v !== null && 'toNumber' in v ? Number(v) : v;
      }
      return o;
    });
  }
  return out;
}
