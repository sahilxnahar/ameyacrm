import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { putObject } from '@/lib/storage/storage';
import { writeAudit } from '@/lib/audit/log';
import { encrypt, randomToken } from '@/lib/utils/crypto';

/**
 * The nightly snapshot. One implementation, used by both callers.
 *
 * ── Why this file exists (AMH-021, corrected) ───────────────────────────────
 *
 * There were TWO backups, and the safe one was the one that never ran.
 *
 *   /api/cron/backup      encrypted the bundle, gave the object a random
 *                         unguessable key — and was NOT in vercel.json, so it
 *                         was never scheduled.
 *
 *   nightly-pass.takeBackup   ran every night as part of /api/cron/daily, and
 *                         wrote `ameya-crm-backup-2026-08-04.json` — PLAIN
 *                         TEXT, `application/json`, and a key derivable from
 *                         nothing but the date.
 *
 * Three things compound there. The object is unencrypted. Its name is
 * guessable, so it does not need to be found, only predicted. And on Vercel
 * Blob every object is readable by anyone holding the link (AMH-018 — that
 * package has no private mode), so "predict the URL" is the whole attack.
 *
 * The contents made it worse. `channelPartner.findMany()` was called with no
 * `select`, and the Prisma extension DECRYPTS on read — so the PAN and bank
 * details that lib/security/pii-crypto.ts protects at rest came back in the
 * clear and went straight into the file. The at-rest encryption was real and
 * the backup walked around it every night.
 *
 * That is the finding the August audit filed as AMH-021. It was retracted in
 * v16.21 as stale, on the strength of reading `/api/admin/backup` — which does
 * select narrowly and is clean. Wrong file. The scheduled one was never looked
 * at. Recording that here because a retraction that was itself wrong is worth
 * more than a fix with no history.
 */

/** Fields that must never leave the database, even inside a backup. */
export interface BackupResult {
  key: string;
  sizeKb: number;
}

/**
 * Build the bundle.
 *
 * Every `findMany` here carries an explicit `select`. That is deliberate and it
 * is the part to keep: a bare `findMany()` returns whatever columns exist
 * today, so the day somebody adds `aadhaarNumber` to a model it silently joins
 * the export. An allow-list cannot do that.
 */
async function buildBundle(now: Date) {
  const [users, projects, units, leads, bookings, payments, customers, partners, invoices] = await Promise.all([
    prisma.user.findMany({ select: { id: true, name: true, username: true, email: true, role: true, status: true, createdAt: true } }),
    prisma.project.findMany(),
    prisma.unit.findMany(),
    prisma.lead.findMany({ where: { deletedAt: null } }),
    prisma.booking.findMany(),
    prisma.paymentMilestone.findMany(),
    prisma.customer.findMany({ select: { id: true, name: true, email: true, phone: true, bookingId: true, isActive: true } }),
    // NOT a bare findMany: panNumber and bankDetails are encrypted at rest and
    // the client extension decrypts them on read, so an unfiltered select puts
    // them into the file in plain text.
    prisma.channelPartner.findMany({
      select: {
        id: true, code: true, firmName: true, contactName: true, email: true, phone: true,
        commissionBasis: true, commissionPct: true, commissionMonths: true, commissionFlat: true,
        reraNumber: true, gstin: true, status: true, kycStatus: true, createdAt: true,
        // Deliberately absent: panNumber, bankDetails (encrypted at rest — the
        // extension would decrypt them straight into the file), portalToken
        // (a live credential; a backup is not a place to keep working keys).
      },
    }),
    prisma.invoice.findMany({ include: { items: true } }),
  ]);
  return { exportedAt: now.toISOString(), users, projects, units, leads, bookings, payments, customers, partners, invoices };
}

/**
 * Take the snapshot and store it.
 *
 * Throws if it cannot be stored. Callers decide what to do about that — but
 * none of them may treat it as success, which is what the old code did.
 */
export async function takeEncryptedBackup(now: Date): Promise<BackupResult> {
  const bundle = await buildBundle(now);

  // Encrypted with the app key, so a leaked or mis-scoped bucket yields
  // ciphertext rather than the customer database.
  const body = Buffer.from(encrypt(JSON.stringify(bundle)), 'utf8');
  const stamp = now.toISOString().slice(0, 10);

  // The random suffix matters as much as the encryption on a provider whose
  // objects are public-by-link: a dated name is a URL you can guess without
  // ever having seen it.
  const key = `backups/ameya-crm-backup-${stamp}-${randomToken(8)}.json.enc`;

  /*
   * ── AMH-024, partially ─────────────────────────────────────────────────────
   *
   * The bundle is still assembled entirely in memory before it is written, and
   * that is not fixed here. It cannot be, at this layer: `putObject` takes a
   * `Buffer`, so a streaming write means changing the storage interface across
   * every provider first. Measured on the test database — 60,000 leads and
   * 80,000 tasks — this takes about four seconds and a multi-megabyte buffer.
   *
   * What IS available is warning before it becomes an outage rather than after.
   * A serverless function has a fixed memory ceiling, and the failure mode when
   * the bundle crosses it is the whole invocation dying — which, on a nightly
   * job, means silence. This puts the size in the audit trail every night and
   * says so out loud once it is large enough to be worth acting on.
   */
  const sizeMb = body.length / 1024 / 1024;
  if (sizeMb > 64) {
    await writeAudit({
      action: 'EXPORT', entityType: 'Backup',
      summary: `Backup is ${sizeMb.toFixed(0)} MB and is built in memory before it is written. `
        + 'It will start failing when it outgrows the function\u2019s memory limit. Move to a streaming export.',
    }).catch(() => undefined);
  }

  const stored = await putObject(key, body, 'application/octet-stream');

  // Rotation deletes by exact key now that the name carries a random suffix,
  // so a stored backup that is never recorded is one that is never cleaned up.
  const { recordBackup } = await import('@/server/services/retention-service');
  await recordBackup(now, stored.key);

  await writeAudit({
    action: 'EXPORT', entityType: 'Backup',
    summary: `Automated backup ${stamp} stored (${Math.round(body.length / 1024)} KB, encrypted)`,
  }).catch(() => undefined);

  return { key: stored.key, sizeKb: Math.round(body.length / 1024) };
}
