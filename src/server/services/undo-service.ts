import 'server-only';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';

/**
 * Put back something that was just deleted (AMH-033).
 *
 * ── Why a recycle bin and not `deletedAt` everywhere ────────────────────────
 *
 * Undo existed on 3 of roughly 120 destructive surfaces. The textbook fix is a
 * soft-delete column on every model, and it was the wrong one here: it means a
 * migration across dozens of tables AND a `deletedAt: null` filter added to
 * every query that touches them. Miss one filter and deleted rows quietly
 * reappear in a list — a worse bug than the one being fixed, and invisible
 * until somebody notices a name they deleted last month.
 *
 * So the delete stays a real delete. The row's own JSON is kept beside it, and
 * undo is an insert. Every existing query is untouched.
 *
 * ── What it will not do ─────────────────────────────────────────────────────
 *
 * It restores ONE row. Anything the database cascade-deleted along with it is
 * gone and is not coming back, and a restore whose parent row no longer exists
 * is refused rather than attempted — a foreign-key error surfaced as "could not
 * restore" is a great deal better than a half-restored object graph.
 *
 * That makes this right for leaf records — a reminder, a hearing, a floor plan,
 * a custom field — and deliberately not offered for things with children.
 */

/** How long an undo stays available. Long enough to notice, short enough that
 *  the bin is not a second copy of the database. */
export const UNDO_WINDOW_HOURS = 72;

export interface Undoable {
  id: string;
  label: string;
}

/**
 * Record a row before deleting it.
 *
 * Call this with the row you are ABOUT to delete — after it is gone there is
 * nothing left to serialise. Returns the token the UI offers as "Undo".
 *
 * Never throws: a recycle-bin failure must not stop the delete the user asked
 * for. It returns null instead, and the caller simply offers no undo.
 */
export async function recordDeletion(
  model: string,
  row: Record<string, unknown> & { id: string },
  opts: { label: string; userId?: string | null },
): Promise<Undoable | null> {
  try {
    const rec = await prisma.deletedRecord.create({
      data: {
        model,
        recordId: row.id,
        label: opts.label.slice(0, 200),
        // Dates and Decimals do not survive JSON on their own; the round-trip
        // through Prisma's own serialiser is what makes the restore faithful.
        payload: JSON.parse(JSON.stringify(row)) as Prisma.InputJsonValue,
        deletedById: opts.userId ?? null,
      },
      select: { id: true, label: true },
    });
    return rec;
  } catch {
    return null;
  }
}

export type RestoreResult = { ok: true; label: string } | { error: string };

/**
 * Put the row back, with the id it had.
 *
 * Restoring under the ORIGINAL id matters: anything that referenced it — an
 * audit line, a link, a document — resolves again. A new id would leave those
 * pointing at nothing.
 */
export async function restoreDeleted(recordId: string, userId: string): Promise<RestoreResult> {
  const rec = await prisma.deletedRecord.findUnique({ where: { id: recordId } });
  if (!rec) return { error: 'There is nothing to undo — it may already have been restored.' };
  if (rec.restoredAt) return { error: `“${rec.label}” has already been put back.` };

  const ageHours = (Date.now() - rec.deletedAt.getTime()) / 3600e3;
  if (ageHours > UNDO_WINDOW_HOURS) {
    return { error: `That was deleted more than ${UNDO_WINDOW_HOURS} hours ago and can no longer be undone.` };
  }

  // The delegate is looked up by name rather than switched on, so a new model
  // needs no change here — but it is validated first, because `model` came out
  // of a database column and indexing the client with it unchecked would be a
  // way to call anything on the Prisma client.
  const delegateName = rec.model.charAt(0).toLowerCase() + rec.model.slice(1);
  const client = prisma as unknown as Record<string, { create?: (a: unknown) => Promise<unknown> }>;
  const delegate = Object.prototype.hasOwnProperty.call(client, delegateName) ? client[delegateName] : undefined;
  if (!delegate?.create) return { error: 'That kind of record can no longer be restored.' };

  try {
    await delegate.create({ data: rec.payload });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    // The two ways this legitimately fails, told apart so the message is useful.
    if (/Foreign key constraint/i.test(msg)) {
      return { error: `“${rec.label}” cannot be put back — what it belonged to has been deleted too.` };
    }
    if (/Unique constraint/i.test(msg)) {
      return { error: `“${rec.label}” cannot be put back — something with the same reference already exists.` };
    }
    return { error: `“${rec.label}” could not be put back.` };
  }

  await prisma.deletedRecord.update({ where: { id: rec.id }, data: { restoredAt: new Date() } });
  return { ok: true, label: rec.label };
}

/** Drop bin entries past the window. Called from the nightly pass. */
export async function pruneDeletedRecords(now: Date): Promise<number> {
  const cutoff = new Date(now.getTime() - UNDO_WINDOW_HOURS * 3600e3);
  const r = await prisma.deletedRecord.deleteMany({ where: { deletedAt: { lt: cutoff } } });
  return r.count;
}
