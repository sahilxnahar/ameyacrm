'use server';
import { z } from 'zod';
import { recordDeletion, type Undoable } from '@/server/services/undo-service';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { getActionContext, toActionError } from './_helpers';
import { datetimeLocalToUTC } from '@/lib/date/ist';

export type ReminderResult = { ok: true; id?: string; undo?: Undoable | null } | { error: string };

const createSchema = z.object({
  title: z.string().min(2).max(160),
  dueAt: z.string().min(4),
  notes: z.string().max(500).optional(),
  leadId: z.string().optional().nullable(),
  userId: z.string().optional().nullable(), // assign to someone else (managers)
});

export async function createReminder(input: unknown): Promise<ReminderResult> {
  try {
    const ctx = await getActionContext();
    const d = createSchema.parse(input);
    /*
     * A datetime-local input submits a bare wall-clock string with no offset, so
     * `new Date(s)` resolved it in the server's zone — UTC — and a reminder set
     * for 15:30 IST fired at 21:00. Parsed as IST explicitly.
     */
    const due = datetimeLocalToUTC(d.dueAt);
    if (!due) return { error: 'That reminder time could not be read.' };
    if (Number.isNaN(due.getTime())) return { error: 'Enter a valid date and time.' };
    const r = await prisma.reminder.create({
      data: { title: d.title, notes: d.notes || null, dueAt: due, leadId: d.leadId || null, userId: d.userId || ctx.user.id, createdById: ctx.user.id },
    });
    revalidatePath('/reminders'); if (d.leadId) revalidatePath(`/sales/${d.leadId}`);
    return { ok: true, id: r.id };
  } catch (err) { return toActionError(err); }
}

async function ownOrFail(id: string): Promise<{ error: string; r?: undefined } | { r: { createdById: string | null; userId: string; leadId: string | null }; error?: undefined }> {
  const ctx = await getActionContext();
  const r = await prisma.reminder.findUnique({ where: { id }, select: { userId: true, createdById: true, leadId: true } });
  if (!r) return { error: 'Reminder not found.' as const };
  if (r.userId !== ctx.user.id && r.createdById !== ctx.user.id && !ctx.permissions.isSuperAdmin) return { error: 'Not your reminder.' as const };
  return { r };
}

export async function completeReminder(id: string): Promise<ReminderResult> {
  try {
    const g = await ownOrFail(id); if (g.error || !g.r) return { error: g.error ?? 'Reminder not found.' };
    await prisma.reminder.update({ where: { id }, data: { status: 'DONE' } });
    revalidatePath('/reminders'); if (g.r.leadId) revalidatePath(`/sales/${g.r.leadId}`);
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

export async function snoozeReminder(id: string, minutes: number): Promise<ReminderResult> {
  try {
    const g = await ownOrFail(id); if (g.error) return { error: g.error };
    const mins = Math.max(5, Math.min(60 * 24 * 14, Number(minutes) || 60));
    await prisma.reminder.update({ where: { id }, data: { dueAt: new Date(Date.now() + mins * 60000), status: 'PENDING', notifiedAt: null } });
    revalidatePath('/reminders');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

export async function deleteReminder(id: string): Promise<ReminderResult> {
  try {
    const g = await ownOrFail(id); if (g.error) return { error: g.error };
    // AMH-033 — keep the row so the delete can be undone. Read BEFORE
    // deleting: after it is gone there is nothing left to serialise.
    const row = await prisma.reminder.findUnique({ where: { id } });
    await prisma.reminder.delete({ where: { id } });
    const undo = row
      ? await recordDeletion('Reminder', row, { label: String(row.title), userId: g.r?.userId ?? null })
      : null;
    revalidatePath('/reminders');
    return { ok: true, undo };
  } catch (err) { return toActionError(err); }
}
