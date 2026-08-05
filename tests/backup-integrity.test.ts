import { describe, expect, it, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const live = process.env.LIVE_DB;

/*
 * The nightly backup (AMH-021 corrected, AMH-025).
 *
 * There were TWO backup implementations and the safe one was the one that never
 * ran. /api/cron/backup encrypted the bundle and gave it a random key — and was
 * not in vercel.json. nightly-pass.takeBackup ran every night and wrote plain
 * JSON under a name derivable from the date alone.
 *
 * AMH-021 was retracted in v16.21 as stale, having read /api/admin/backup —
 * which is genuinely clean. Wrong file. These tests exist because a retraction
 * that was itself wrong needs a standing check, not a second opinion.
 */
describe('there is one backup implementation and it is the safe one', () => {
  it('the nightly pass does not build its own bundle', () => {
    const src = read('src/server/services/nightly-pass.ts');
    expect(src).toContain('takeEncryptedBackup');
    // The old body: a bare JSON.stringify straight to putObject.
    expect(src).not.toMatch(/application\/json'\)/);
    expect(src).not.toMatch(/ameya-crm-backup-\$\{stamp\}\.json/);
  });

  it('the bundle never selects a field the PII layer protects', () => {
    /*
     * `channelPartner.findMany()` was called with no select, and the Prisma
     * extension DECRYPTS on read — so the PAN and bank details encrypted at
     * rest came back in the clear and went into the file. The at-rest
     * encryption was real and the backup walked around it every night.
     */
    const src = read('src/server/services/backup-service.ts');
    const select = src.slice(src.indexOf('prisma.channelPartner.findMany'), src.indexOf('prisma.invoice.findMany'));
    for (const field of ['panNumber', 'bankDetails', 'portalToken']) {
      expect(select, `the backup selects ${field}`).not.toMatch(new RegExp(`${field}:\\s*true`));
    }
    // And it must be an allow-list, not a bare findMany that picks up whatever
    // column somebody adds next.
    expect(select).toContain('select:');
  });

  it('rotation deletes the object that was written, not a guessed name', () => {
    // The old rotation rebuilt the key from the date. With a random suffix that
    // matches nothing, so it would have failed silently forever while storage
    // filled up — and the failure was already inside a .catch.
    const src = read('src/server/services/retention-service.ts');
    expect(src).not.toMatch(/deleteObject\(`backups\/ameya-crm-backup-\$\{stamp\}\.json`\)/);
    expect(src).toContain('BACKUP_INDEX_KEY');
    expect(read('src/server/services/backup-service.ts')).toContain('recordBackup');
  });
});

describe('the jobs that were never scheduled now are (AMH-025)', () => {
  const vercel = JSON.parse(read('vercel.json')) as { crons?: Array<{ path: string; schedule: string }> };
  const paths = (vercel.crons ?? []).map((c) => c.path);

  it('the webhook queue is drained by something', () => {
    // It drains ONLY when this route is called. Unscheduled, every event sat
    // PENDING forever — which is why the Command Centre's "Webhook queue" tile
    // could only ever count up.
    expect(paths).toContain('/api/cron/worker');
  });

  it('hourly housekeeping and unit-hold release run', () => {
    expect(paths).toContain('/api/cron/escalate');
    expect(paths).toContain('/api/cron/auto-release');
  });

  it('the duplicates are NOT scheduled', () => {
    /*
     * /api/cron/backup, /reminders and /payment-reminders all do work the
     * nightly pass already does. Scheduling them would have run the backup
     * twice a night and sent every reminder twice — the obvious "fix" for this
     * finding, and worse than the finding.
     */
    for (const dupe of ['/api/cron/backup', '/api/cron/reminders', '/api/cron/payment-reminders']) {
      expect(paths, `${dupe} duplicates the nightly pass`).not.toContain(dupe);
    }
  });
});

(live ? describe : describe.skip)('proved against a real database and store', () => {
  beforeAll(() => { process.env.DATABASE_URL = live; process.env.STORAGE_PROVIDER = 'local'; });

  it('writes ciphertext under an unguessable key', { timeout: 60_000 }, async () => {
    const { takeEncryptedBackup } = await import('../src/server/services/backup-service');
    const r = await takeEncryptedBackup(new Date('2026-08-04T00:00:00Z'));

    // A dated name is a URL you can guess without ever having seen it — and on
    // Vercel Blob every object is readable by anyone holding the link.
    expect(r.key).toMatch(/backups\/ameya-crm-backup-2026-08-04-[A-Za-z0-9_-]{8,}\.json\.enc$/);

    const { getObjectStream } = await import('../src/lib/storage/storage');
    const text = (await getObjectStream(r.key)).body.toString('utf8');
    expect(text).not.toContain('exportedAt');
    expect(text).not.toContain('firmName');
    expect(text.split('.')).toHaveLength(3); // iv.tag.ciphertext
  });
});

/**
 * AMH-064 — retention has to bound COUNT as well as age, and it must never
 * forget an object it has not deleted.
 */
describe('backup retention actually bounds what is kept', () => {
  it('rotateBackups takes a count cap and applies it newest-first', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync('src/server/services/retention-service.ts', 'utf8');
    expect(src).toMatch(/export async function rotateBackups\(now: Date, keepDays = \d+, keepMax = \d+\)/);
    // Slice to the END of rotateBackups, not to the end of the file — the
    // previous version's ternary returned src.length on both branches, so every
    // assertion below was really being made against the whole module.
    const from = src.indexOf('export async function rotateBackups');
    const nextFn = src.indexOf('\nexport ', from + 1);
    const body = src.slice(from, nextFn > -1 ? nextFn : src.length);
    expect(body).toMatch(/const tooOld =/);
    expect(body).toMatch(/const tooMany = i >= keepMax/);
    // Sorted before the index is used, or "newest" is whatever order it landed in.
    expect(body).toMatch(/\.sort\(\(a, b\) => \(a\.date < b\.date \? 1 : -1\)\)/);
  });

  it('recordBackup no longer trims the index, which orphaned the objects', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync('src/server/services/retention-service.ts', 'utf8');
    const record = src.slice(src.indexOf('export async function recordBackup'));
    // There is no `list` on the storage interface: an entry dropped from the
    // index is an object nothing can name again, so it can never be deleted.
    // Assert on the SIGNATURE as well — `keepMax` is gone from the parameter
    // list, which is the thing that cannot be reintroduced by accident. (The
    // old `.not.toMatch(/\.slice\(0, keepMax\)/)` was vacuous: `keepMax` was
    // no longer in scope, so nothing could have matched it.)
    expect(record).toMatch(/export async function recordBackup\(date: Date, key: string\): Promise<void>/);
    expect(record).not.toMatch(/\.slice\(0,/);
    expect(record).toMatch(/writeIndex\(\[\{ date: date\.toISOString\(\), key \}, \.\.\.index\]\)/);
  });
});
