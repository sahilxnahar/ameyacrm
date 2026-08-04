import 'server-only';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';

/**
 * DPDPA retention enforcement.
 *
 * "Don't keep personal data longer than you need it." The admin sets a retention
 * period (Admin → Privacy → months). This sweep enforces it conservatively: only
 * dead leads — status LOST, already inactive, untouched for longer than the
 * retention period, and not under a booking — are soft-deleted and their contact
 * details cleared. Won deals, active buyers and anything financial are never
 * touched here (statute requires those be retained, in anonymised form, which the
 * manual erasure flow handles).
 *
 * Retention of 0 (or unset) means "disabled" — nothing is swept. Every run is
 * audited with a count, never a silent deletion.
 */
export async function runRetentionSweep(now: Date): Promise<{ enabled: boolean; months: number; leadsPurged: number }> {
  let months = 0;
  try {
    const row = await prisma.setting.findUnique({ where: { key: 'dpdp.retentionMonths' } });
    months = Number(row?.value ?? 0) || 0;
  } catch {
    return { enabled: false, months: 0, leadsPurged: 0 };
  }
  if (months <= 0) return { enabled: false, months: 0, leadsPurged: 0 };

  const cutoff = new Date(now.getTime());
  cutoff.setMonth(cutoff.getMonth() - months);

  let leadsPurged = 0;
  try {
    const stale = await prisma.lead.findMany({
      where: {
        deletedAt: null,
        status: 'LOST',
        updatedAt: { lt: cutoff },
        bookings: { none: {} }, // never touch a lead that became a booking
      },
      select: { id: true },
      take: 2000,
    });
    // One statement, not one per lead. `take: 2000` above meant the nightly
    // retention sweep could make two thousand sequential round-trips; every row
    // gets the identical anonymised value, so there was never a reason to.
    if (stale.length) {
      const done = await prisma.lead.updateMany({
        where: { id: { in: stale.map((l) => l.id) } },
        data: {
          name: 'Removed (retention)', email: null, phone: null, requirement: null,
          locality: null, latitude: null, longitude: null,
          consentAt: null, consentSource: null, deletedAt: now,
        },
      });
      leadsPurged = done.count;
    }
    if (leadsPurged > 0) {
      await writeAudit({ action: 'DELETE', entityType: 'Lead', summary: `Retention sweep: removed ${leadsPurged} dead lead(s) older than ${months} months` }).catch(() => undefined);
    }
  } catch {
    // Missing column / not migrated — treat as no-op rather than failing the cron.
  }

  return { enabled: true, months, leadsPurged };
}

/**
 * Rolling backup retention: the daily job writes one dated JSON snapshot. Keep a
 * fixed window and delete the one that has just aged out — no directory listing
 * needed, because the key is deterministic from the date.
 */
export async function rotateBackups(now: Date, keepDays = 180, keepMax = 120): Promise<void> {
  /*
   * ── Why this keeps an index ────────────────────────────────────────────────
   *
   * This used to rebuild the key from the date —
   * `backups/ameya-crm-backup-2026-02-05.json` — and delete that. It worked
   * only because the key was fully predictable, which was the same property
   * that made the backup itself guessable from the outside (see
   * backup-service.ts). Now that every object carries a random suffix, a
   * derived name matches nothing, and the delete would fail silently forever
   * while storage filled up.
   *
   * There is no `list` on the storage interface, so the index is kept here: an
   * append-only record of {date, key}, trimmed as it rotates. Provider-agnostic
   * and exact — it deletes the object that was actually written, not the one
   * whose name we can reconstruct.
   */
  const { deleteObject } = await import('@/lib/storage/storage');
  const cutoff = new Date(now.getTime());
  cutoff.setDate(cutoff.getDate() - keepDays);

  try {
    const index = await readIndex();
    if (!index.length) return;

    /*
     * ── AMH-064: a count cap as well as an age cap ────────────────────────────
     *
     * Age alone assumes one backup a day. This snapshot is also taken by the
     * manual route, by an external scheduler, and by anyone who presses the
     * button — and on the machine where this was found there were seven
     * identical 45 MB snapshots from a single day, every one of them 180 days
     * from being eligible for deletion. At that rate the age cap is not a
     * retention policy, it is a countdown.
     *
     * Newest first, keep `keepMax`, drop the rest regardless of age. The floor
     * still holds: nothing inside `keepDays` is dropped unless there are more
     * than `keepMax` newer than it, so a real recovery window is never traded
     * away for disk.
     */
    const ordered = [...index].sort((a, b) => (a.date < b.date ? 1 : -1));

    const keep: BackupEntry[] = [];
    const drop: BackupEntry[] = [];
    for (const [i, entry] of ordered.entries()) {
      const tooOld = new Date(entry.date) < cutoff;
      const tooMany = i >= keepMax;
      (tooOld || tooMany ? drop : keep).push(entry);
    }
    if (!drop.length) return;

    for (const entry of drop) {
      // A delete that fails leaves the entry in the index, so it is retried
      // tomorrow rather than forgotten.
      try {
        await deleteObject(entry.key);
      } catch {
        keep.push(entry);
      }
    }
    await writeIndex(keep);
  } catch {
    /* Retention must never be the reason the nightly pass fails. */
  }
}

/** Where the rolling record of stored backups lives. */
export const BACKUP_INDEX_KEY = 'backup.index';

/** One stored backup, as recorded in the index. */
const backupEntry = z.object({ date: z.string(), key: z.string() });
export type BackupEntry = z.infer<typeof backupEntry>;

/**
 * Read the index.
 *
 * Parsed rather than cast: `Setting.value` is a JSON column, so its contents
 * are whatever was last written there — including by an older version of this
 * code, or by hand. A bad entry drops out instead of throwing halfway through
 * a rotation and leaving the index inconsistent with storage.
 */
async function readIndex(): Promise<BackupEntry[]> {
  const row = await prisma.setting.findUnique({ where: { key: BACKUP_INDEX_KEY } });
  const parsed = z.array(backupEntry).safeParse(row?.value);
  if (parsed.success) return parsed.data;
  return Array.isArray(row?.value)
    ? (row.value as unknown[]).flatMap((v) => {
        const one = backupEntry.safeParse(v);
        return one.success ? [one.data] : [];
      })
    : [];
}

async function writeIndex(entries: BackupEntry[]): Promise<void> {
  const value: Prisma.InputJsonValue = entries;
  await prisma.setting.upsert({
    where: { key: BACKUP_INDEX_KEY },
    update: { value },
    create: { key: BACKUP_INDEX_KEY, value },
  });
}

/**
 * Record a stored backup so rotation can find it again.
 *
 * AMH-064 — this used to trim the index at 400 entries. There is no `list` on
 * the storage interface, so an entry that falls out of the index is an object
 * nothing can ever name again: rotation could not delete it, and it sat in the
 * bucket for the life of the account. Trimming the ledger is not the same as
 * clearing the shelf.
 *
 * Nothing is dropped here now. `rotateBackups` owns eviction, because it is the
 * only place that deletes the object first and removes the entry second.
 */
export async function recordBackup(date: Date, key: string): Promise<void> {
  try {
    const index = await readIndex();
    await writeIndex([{ date: date.toISOString(), key }, ...index]);
  } catch {
    /* An unrecorded backup is still a backup; do not fail the run over it. */
  }
}
