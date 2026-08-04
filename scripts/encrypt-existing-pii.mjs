#!/usr/bin/env node
/**
 * Encrypt PII that was written before its field was protected.
 *
 *     ENCRYPTION_KEY=… DATABASE_URL=… node scripts/encrypt-existing-pii.mjs
 *     ENCRYPTION_KEY=… DATABASE_URL=… node scripts/encrypt-existing-pii.mjs --apply
 *
 * Without `--apply` it only reports. Nothing is written until you ask.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 *
 * `lib/security/pii-crypto.ts` encrypts on write and decrypts on read, and its
 * stated design is that older plaintext values are left alone — `decryptSafe`
 * returns them unchanged, and they become encrypted the next time the row is
 * saved. That is the right default: no bulk migration, no risk of a value
 * becoming unreadable.
 *
 * It has one consequence worth naming. A field that is rarely edited stays in
 * plaintext more or less forever. `NriComplianceProfile.passportNo` and
 * `ChannelPartner.bankDetails` were added to the protected set in v16.21
 * (AMH-022), and a passport number is typed once at onboarding and never
 * touched again — so "it will encrypt on next write" means "never" for exactly
 * the records that matter most.
 *
 * ── Safety ──────────────────────────────────────────────────────────────────
 *
 * Idempotent: `looksEncrypted` skips anything already done, so running it twice
 * is a no-op and an interrupted run can simply be re-run.
 *
 * It deliberately does NOT go through the Prisma client extension — that would
 * decrypt on read and re-encrypt on write, which is a slower way of doing
 * nothing. Raw SQL, one field at a time, so a failure on one row cannot corrupt
 * another.
 *
 * Take a backup first. (Check Admin → Integrations that the nightly one is
 * actually storing — as of v16.20 it will tell you the truth about that.)
 */
import { PrismaClient } from '@prisma/client';
import { createCipheriv, randomBytes, createHash } from 'node:crypto';

const APPLY = process.argv.includes('--apply');

// Must match lib/utils/crypto.ts EXACTLY. Duplicated rather than imported
// because that module is TypeScript behind a path alias and this is plain node.
//
// Getting this wrong is the one way this script can do real damage: a value
// written in a format the app cannot read is a passport number that is now
// lost rather than protected. Verified against the source, field by field:
//   - key:    sha256(ENCRYPTION_KEY) — ALWAYS hashed, never used raw
//   - format: iv.tag.ciphertext, three base64url parts joined by dots
//   - cipher: aes-256-gcm, 12-byte IV
// There is no version prefix.
const looksEncrypted = (v) => {
  if (typeof v !== 'string') return false;
  const parts = v.split('.');
  return parts.length === 3 && parts.every((p) => p.length > 0 && /^[A-Za-z0-9_-]+$/.test(p));
};

function key() {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error('ENCRYPTION_KEY is not set. It must be the SAME key the app runs with.');
  return createHash('sha256').update(raw).digest();
}

function encrypt(plain, k) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', k, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, enc].map((b) => b.toString('base64url')).join('.');
}

// table, column — quoted for Postgres' case sensitivity.
const TARGETS = [
  ['NriComplianceProfile', 'passportNo'],
  ['ChannelPartner', 'bankDetails'],
  ['ChannelPartner', 'panNumber'],
  ['Vendor', 'bankAccountNumber'],
  ['Vendor', 'pan'],
];

const prisma = new PrismaClient();

try {
  const k = key();
  console.log(APPLY ? 'Applying.\n' : 'Dry run — nothing will be written. Add --apply to do it.\n');
  let totalPending = 0;

  for (const [table, column] of TARGETS) {
    let rows;
    try {
      rows = await prisma.$queryRawUnsafe(
        `SELECT "id", "${column}" AS v FROM "${table}" WHERE "${column}" IS NOT NULL AND "${column}" <> ''`,
      );
    } catch (err) {
      // A table that does not exist on this database is not an error: features
      // roll out at different times and this script must run anywhere.
      console.log(`  ${table}.${column}: not present on this database — skipped`);
      continue;
    }

    const pending = rows.filter((r) => !looksEncrypted(r.v));
    totalPending += pending.length;
    console.log(`  ${table}.${column}: ${rows.length} rows, ${pending.length} still plaintext`);

    if (!APPLY || pending.length === 0) continue;

    let done = 0;
    for (const row of pending) {
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE "${table}" SET "${column}" = $1 WHERE "id" = $2`,
          encrypt(String(row.v), k),
          row.id,
        );
        done++;
      } catch (err) {
        console.error(`    ! ${table}.${column} id=${row.id}: ${err.message}`);
      }
    }
    console.log(`    encrypted ${done}/${pending.length}`);
  }

  console.log(
    totalPending === 0
      ? '\nNothing to do — every protected field is already encrypted.'
      : APPLY
        ? '\nDone. Re-run without --apply to confirm the count is now zero.'
        : `\n${totalPending} value(s) would be encrypted. Re-run with --apply.`,
  );
} finally {
  await prisma.$disconnect();
}
