'use server';
import { revalidatePath } from 'next/cache';
import { addMonths, addWeeks, addYears } from 'date-fns';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from './_helpers';

export type RecurringResult = { ok: true; id?: string } | { error: string };

const FREQS = ['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'] as const;
type Freq = (typeof FREQS)[number];

function advance(from: Date, freq: string): Date {
  switch (freq) {
    case 'WEEKLY': return addWeeks(from, 1);
    case 'QUARTERLY': return addMonths(from, 3);
    case 'YEARLY': return addYears(from, 1);
    default: return addMonths(from, 1);
  }
}

export async function createRecurring(input: {
  payeeName: string; amount: number | string; frequency: string; nextDue: string;
  category?: string; mode?: string; note?: string;
}): Promise<RecurringResult> {
  try {
    const ctx = await ensure('billing.bill.manage');
    const payeeName = input.payeeName.trim();
    const amount = Number(input.amount);
    if (!payeeName) return { error: 'Who is this paid to?' };
    if (!Number.isFinite(amount) || amount <= 0) return { error: 'Enter an amount above zero.' };
    const freq: Freq = (FREQS as readonly string[]).includes(input.frequency) ? (input.frequency as Freq) : 'MONTHLY';
    const nextDue = input.nextDue ? new Date(input.nextDue) : new Date();

    const rec = await prisma.recurringPayment.create({
      data: {
        payeeName, amount, frequency: freq, nextDue,
        accountCode: (input.category ?? '').trim() || null,
        mode: (input.mode ?? '').trim() || null,
        note: (input.note ?? '').trim() || null,
        createdById: ctx.user.id,
      },
      select: { id: true },
    });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'RecurringPayment', entityId: rec.id, summary: `Recurring: ${payeeName} — Rs ${amount.toLocaleString('en-IN')} ${freq.toLowerCase()}` });
    revalidatePath('/recurring');
    return { ok: true, id: rec.id };
  } catch (e) { return toActionError(e); }
}

export async function setRecurringActive(id: string, isActive: boolean): Promise<RecurringResult> {
  try {
    const ctx = await ensure('billing.bill.manage');
    await prisma.recurringPayment.update({ where: { id }, data: { isActive } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'RecurringPayment', entityId: id, summary: isActive ? 'Recurring resumed' : 'Recurring paused' });
    revalidatePath('/recurring');
    return { ok: true };
  } catch (e) { return toActionError(e); }
}

export async function deleteRecurring(id: string): Promise<RecurringResult> {
  try {
    const ctx = await ensure('billing.bill.manage');
    await prisma.recurringPayment.delete({ where: { id } });
    await writeAudit({ actorId: ctx.user.id, action: 'DELETE', entityType: 'RecurringPayment', entityId: id, summary: 'Recurring deleted' });
    revalidatePath('/recurring');
    return { ok: true };
  } catch (e) { return toActionError(e); }
}

/** Record this recurring payment as made now: creates a real payment and rolls the next due date forward. */
export async function recordRecurringNow(id: string, utr?: string): Promise<RecurringResult> {
  try {
    const ctx = await ensure('billing.bill.manage');
    const rec = await prisma.recurringPayment.findUnique({ where: { id } });
    if (!rec) return { error: 'That recurring payment no longer exists.' };

    const last = await prisma.voucher.findFirst({ where: { number: { startsWith: 'CP-' } }, orderBy: { number: 'desc' }, select: { number: true } });
    const seq = (last ? Number(last.number.split('-')[1] ?? '1000') : 1000) + 1;
    const cleanUtr = utr ? utr.replace(/[^A-Za-z0-9]/g, '').toUpperCase() : null;
    const now = new Date();

    await prisma.voucher.create({
      data: {
        number: `CP-${seq}`, kind: rec.mode === 'Cash' ? 'CASH_PAID' : 'BANK_PAID', status: 'POSTED',
        voucherDate: now, paidOn: rec.mode === 'Cash' ? null : now,
        partyName: rec.payeeName, vendorId: rec.vendorId, amount: rec.amount,
        mode: rec.mode === 'Cash' ? 'CASH' : rec.mode === 'UPI' ? 'UPI' : rec.mode === 'Cheque' ? 'CHEQUE' : 'BANK_TRANSFER',
        utr: cleanUtr, utrEnteredById: cleanUtr ? ctx.user.id : null, utrEnteredAt: cleanUtr ? now : null,
        narration: rec.note ?? `Recurring: ${rec.payeeName}`,
        accountCode: rec.accountCode, projectId: rec.projectId,
        createdById: ctx.user.id,
      },
    });

    await prisma.recurringPayment.update({
      where: { id },
      data: { lastPaidAt: now, nextDue: advance(rec.nextDue < now ? now : rec.nextDue, rec.frequency) },
    });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'Voucher', summary: `Recurring paid: ${rec.payeeName} — Rs ${Number(rec.amount).toLocaleString('en-IN')}` });
    revalidatePath('/recurring');
    revalidatePath('/ledgers');
    revalidatePath('/payments');
    return { ok: true };
  } catch (e) { return toActionError(e); }
}
