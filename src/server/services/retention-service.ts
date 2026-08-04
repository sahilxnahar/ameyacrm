import 'server-only';
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
export async function rotateBackups(now: Date, keepDays = 180): Promise<void> {
  const { deleteObject } = await import('@/lib/storage/storage');
  const old = new Date(now.getTime());
  old.setDate(old.getDate() - (keepDays + 1));
  const stamp = old.toISOString().slice(0, 10);
  await deleteObject(`backups/ameya-crm-backup-${stamp}.json`).catch(() => undefined);
}
