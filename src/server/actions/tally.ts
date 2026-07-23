'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { GROUP_NAMES, VOUCHER_TYPES } from '@/config/tally-groups';
import { ensure, toActionError } from './_helpers';

export type TallyResult = { ok: true; id?: string } | { error: string };

const ledgerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(120),
  group: z.enum(GROUP_NAMES as [string, ...string[]]),
  openingBalance: z.coerce.number().min(0).default(0),
  openingSide: z.enum(['Dr', 'Cr']).default('Dr'),
});

/** Create a ledger master (F3-style). */
export async function createTallyLedger(input: unknown): Promise<TallyResult> {
  try {
    const ctx = await ensure('finance.ledger.view');
    const d = ledgerSchema.parse(input);
    const exists = await prisma.tallyLedger.findUnique({ where: { name: d.name }, select: { id: true } });
    if (exists) return { error: 'A ledger with that name already exists.' };
    const l = await prisma.tallyLedger.create({ data: { name: d.name.trim(), group: d.group, openingBalance: d.openingBalance, openingSide: d.openingSide } });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'TallyLedger', entityId: l.id, summary: `Tally ledger ${d.name}` });
    revalidatePath('/tally');
    return { ok: true, id: l.id };
  } catch (e) { return toActionError(e); }
}

export async function deleteTallyLedger(id: string): Promise<TallyResult> {
  try {
    const ctx = await ensure('finance.ledger.view');
    const l = await prisma.tallyLedger.findUnique({ where: { id }, select: { isSystem: true, name: true, _count: { select: { lines: true } } } });
    if (!l) return { error: 'Ledger not found.' };
    if (l.isSystem) return { error: `${l.name} is a system ledger and cannot be deleted.` };
    if (l._count.lines > 0) return { error: 'This ledger has entries — delete the vouchers first.' };
    await prisma.tallyLedger.delete({ where: { id } });
    await writeAudit({ actorId: ctx.user.id, action: 'DELETE', entityType: 'TallyLedger', entityId: id, summary: `Deleted Tally ledger ${l.name}` });
    revalidatePath('/tally');
    return { ok: true };
  } catch (e) { return toActionError(e); }
}

const voucherSchema = z.object({
  type: z.enum(VOUCHER_TYPES as unknown as [string, ...string[]]),
  date: z.string().min(1),
  narration: z.string().max(500).optional(),
  reference: z.string().max(80).optional(),
  lines: z.array(z.object({
    ledgerId: z.string().min(1),
    debit: z.coerce.number().min(0).default(0),
    credit: z.coerce.number().min(0).default(0),
  })).min(2, 'A voucher needs at least two lines'),
});

/** Post a balanced double-entry voucher (F4–F9). */
export async function createTallyVoucher(input: unknown): Promise<TallyResult> {
  try {
    const ctx = await ensure('finance.ledger.view');
    const d = voucherSchema.parse(input);
    const lines = d.lines.filter((l) => l.ledgerId && (l.debit > 0 || l.credit > 0));
    if (lines.length < 2) return { error: 'Enter at least two ledger lines with amounts.' };
    const totalDr = Math.round(lines.reduce((s, l) => s + l.debit, 0) * 100);
    const totalCr = Math.round(lines.reduce((s, l) => s + l.credit, 0) * 100);
    if (totalDr === 0) return { error: 'The voucher amount cannot be zero.' };
    if (totalDr !== totalCr) return { error: `Debit and credit must match. Dr ₹${(totalDr / 100).toLocaleString('en-IN')} vs Cr ₹${(totalCr / 100).toLocaleString('en-IN')}.` };

    const last = await prisma.tallyVoucher.findFirst({ where: { type: d.type }, orderBy: { number: 'desc' }, select: { number: true } });
    const number = (last?.number ?? 0) + 1;

    const v = await prisma.tallyVoucher.create({
      data: {
        type: d.type, number, date: new Date(d.date), narration: d.narration || null, reference: d.reference || null,
        createdById: ctx.user.id,
        lines: { create: lines.map((l) => ({ ledgerId: l.ledgerId, debit: l.debit, credit: l.credit })) },
      },
      select: { id: true },
    });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'TallyVoucher', entityId: v.id, summary: `Tally ${d.type} #${number} — Rs ${(totalDr / 100).toLocaleString('en-IN')}` });
    revalidatePath('/tally');
    return { ok: true, id: v.id };
  } catch (e) { return toActionError(e); }
}

export async function deleteTallyVoucher(id: string): Promise<TallyResult> {
  try {
    const ctx = await ensure('finance.ledger.view');
    const v = await prisma.tallyVoucher.findUnique({ where: { id }, select: { type: true, number: true } });
    if (!v) return { error: 'Voucher not found.' };
    await prisma.tallyVoucher.delete({ where: { id } });
    await writeAudit({ actorId: ctx.user.id, action: 'DELETE', entityType: 'TallyVoucher', entityId: id, summary: `Deleted Tally ${v.type} #${v.number}` });
    revalidatePath('/tally');
    return { ok: true };
  } catch (e) { return toActionError(e); }
}
