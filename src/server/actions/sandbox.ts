'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { getCurrentUser } from '@/lib/auth/current-user';
import { getOrCreateSandbox } from '@/server/services/sandbox-service';
import { toActionError } from '@/server/actions/_helpers';

export type SandboxResult = { ok: true } | { error: string };

/**
 * Guest sandbox writes.
 *
 * These are the ONLY mutations a guest may perform, and they deliberately do
 * not go through `ensure()`/`getActionContext()` — that helper refuses guests
 * outright, which is exactly what should keep happening for every real action
 * in the app. Instead each function here resolves the caller's own sandbox and
 * writes only inside it.
 *
 * Two properties make this safe:
 *  1. Every statement targets a Sandbox* table. No real table is reachable.
 *  2. The sandbox id is derived from the session, never taken from the caller,
 *     so a guest cannot address another guest's playground by passing an id.
 */
async function currentSandbox(): Promise<{ sandboxId: string } | { error: string }> {
  const ctx = await getCurrentUser();
  if (!ctx) return { error: 'Please sign in again.' };
  if (ctx.user.role !== 'GUEST') {
    return { error: 'The demo workspace is only for guest accounts.' };
  }
  const { id } = await getOrCreateSandbox(ctx.user.id);
  return { sandboxId: id };
}

const leadSchema = z.object({
  name: z.string().min(2, 'Enter a name').max(80),
  phone: z.string().max(20).optional().or(z.literal('')),
  email: z.string().max(120).optional().or(z.literal('')),
  source: z.string().max(40).default('Walk-in'),
  budget: z.coerce.number().nonnegative().max(1_000_000_000).optional(),
  note: z.string().max(500).optional().or(z.literal('')),
});

export async function sandboxAddLead(input: unknown): Promise<SandboxResult> {
  try {
    const s = await currentSandbox();
    if ('error' in s) return s;
    const d = leadSchema.parse(input);
    await prisma.sandboxLead.create({
      data: {
        sandboxId: s.sandboxId, name: d.name, phone: d.phone || null, email: d.email || null,
        source: d.source || 'Walk-in', budget: d.budget ?? null, note: d.note || null, status: 'NEW',
      },
    });
    revalidatePath('/preview');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

export async function sandboxSetLeadStatus(id: string, status: string): Promise<SandboxResult> {
  try {
    const s = await currentSandbox();
    if ('error' in s) return s;
    const allowed = ['NEW', 'QUALIFIED', 'SITE_VISIT', 'NEGOTIATION', 'BOOKED', 'LOST'];
    if (!allowed.includes(status)) return { error: 'Unknown status.' };
    // Scoped by sandboxId as well as id: an id alone must not be enough to
    // reach into a different guest's workspace.
    await prisma.sandboxLead.updateMany({ where: { id, sandboxId: s.sandboxId }, data: { status } });
    revalidatePath('/preview');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

export async function sandboxDeleteLead(id: string): Promise<SandboxResult> {
  try {
    const s = await currentSandbox();
    if ('error' in s) return s;
    await prisma.sandboxLead.deleteMany({ where: { id, sandboxId: s.sandboxId } });
    revalidatePath('/preview');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

export async function sandboxAddTask(title: string, dueDate?: string): Promise<SandboxResult> {
  try {
    const s = await currentSandbox();
    if ('error' in s) return s;
    const t = String(title ?? '').trim().slice(0, 160);
    if (t.length < 2) return { error: 'Enter a task.' };
    await prisma.sandboxTask.create({
      data: { sandboxId: s.sandboxId, title: t, dueDate: dueDate ? new Date(dueDate) : null },
    });
    revalidatePath('/preview');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

export async function sandboxToggleTask(id: string, done: boolean): Promise<SandboxResult> {
  try {
    const s = await currentSandbox();
    if ('error' in s) return s;
    await prisma.sandboxTask.updateMany({ where: { id, sandboxId: s.sandboxId }, data: { done } });
    revalidatePath('/preview');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

export async function sandboxSetUnitStatus(id: string, status: string): Promise<SandboxResult> {
  try {
    const s = await currentSandbox();
    if ('error' in s) return s;
    const allowed = ['AVAILABLE', 'HELD', 'BOOKED'];
    if (!allowed.includes(status)) return { error: 'Unknown status.' };
    await prisma.sandboxUnit.updateMany({ where: { id, sandboxId: s.sandboxId }, data: { status } });
    revalidatePath('/preview');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

const entrySchema = z.object({
  narration: z.string().min(2, 'What is this entry for?').max(200),
  debitAcc: z.string().min(1).max(60),
  creditAcc: z.string().min(1).max(60),
  amount: z.coerce.number().positive('Enter an amount').max(1_000_000_000),
  date: z.string().optional(),
});

export async function sandboxAddEntry(input: unknown): Promise<SandboxResult> {
  try {
    const s = await currentSandbox();
    if ('error' in s) return s;
    const d = entrySchema.parse(input);
    if (d.debitAcc === d.creditAcc) return { error: 'Debit and credit cannot be the same account.' };
    await prisma.sandboxLedgerEntry.create({
      data: {
        sandboxId: s.sandboxId, narration: d.narration, debitAcc: d.debitAcc, creditAcc: d.creditAcc,
        amount: d.amount, date: d.date ? new Date(d.date) : new Date(),
      },
    });
    revalidatePath('/preview');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

export async function sandboxAddNote(body: string): Promise<SandboxResult> {
  try {
    const s = await currentSandbox();
    if ('error' in s) return s;
    const b = String(body ?? '').trim().slice(0, 1000);
    if (b.length < 1) return { error: 'Write something first.' };
    await prisma.sandboxNote.create({ data: { sandboxId: s.sandboxId, body: b } });
    revalidatePath('/preview');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

/** Put the playground back to how it started. */
export async function sandboxReset(): Promise<SandboxResult> {
  try {
    const ctx = await getCurrentUser();
    if (!ctx || ctx.user.role !== 'GUEST') return { error: 'Only guest accounts have a demo workspace.' };
    await prisma.guestSandbox.deleteMany({ where: { userId: ctx.user.id } });
    await getOrCreateSandbox(ctx.user.id);
    revalidatePath('/preview');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}
