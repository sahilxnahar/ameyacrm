'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from '@/server/actions/_helpers';
import { KIND_META, VOUCHER_KINDS, PAY_MODES, type VoucherKind } from '@/config/vouchers';

export type VoucherResult = { ok: true; id?: string; number?: string; message?: string } | { error: string };

/** CR-1001, CP-1002 … one running series per voucher type. */
async function nextNumber(kind: VoucherKind): Promise<string> {
  const prefix = KIND_META[kind].prefix;
  const last = await prisma.voucher.findFirst({
    where: { number: { startsWith: `${prefix}-` } },
    orderBy: { number: 'desc' },
    select: { number: true },
  });
  const n = last ? Number(last.number.split('-')[1] ?? '1000') : 1000;
  return `${prefix}-${(Number.isFinite(n) ? n : 1000) + 1}`;
}

const schema = z.object({
  kind: z.enum(VOUCHER_KINDS),
  voucherDate: z.string().optional(),
  partyName: z.string().min(2, 'Who is this with?').max(160),
  partyPhone: z.string().max(20).optional().or(z.literal('')),
  projectId: z.string().optional().or(z.literal('')),
  bookingId: z.string().optional().or(z.literal('')),
  amount: z.coerce.number().min(0).default(0),
  mode: z.enum(PAY_MODES).default('CASH'),
  reference: z.string().max(80).optional().or(z.literal('')),
  narration: z.string().max(500).optional().or(z.literal('')),
  materialName: z.string().max(160).optional().or(z.literal('')),
  quantity: z.coerce.number().min(0).optional(),
  unit: z.string().max(20).optional().or(z.literal('')),
  rate: z.coerce.number().min(0).optional(),
  gstRate: z.coerce.number().min(0).max(30).optional(),
});

export async function createVoucher(input: unknown): Promise<VoucherResult> {
  try {
    const ctx = await ensure('billing.invoice.manage');
    const d = schema.parse(input);
    const meta = KIND_META[d.kind];

    // A material voucher needs the goods named; a money one needs an amount.
    if (meta.isMaterial && !d.materialName) return { error: 'Name the material that moved.' };
    if (!meta.isMaterial && d.amount <= 0) return { error: 'Enter an amount above zero.' };

    // Material vouchers can price themselves from quantity × rate.
    let amount = d.amount;
    if (meta.isMaterial && !amount && d.quantity && d.rate) amount = d.quantity * d.rate;
    const gstAmount = d.gstRate ? Math.round(((amount * d.gstRate) / 100) * 100) / 100 : null;

    const number = await nextNumber(d.kind);
    const v = await prisma.voucher.create({
      data: {
        number, kind: d.kind,
        voucherDate: d.voucherDate ? new Date(d.voucherDate) : new Date(),
        partyName: d.partyName.trim(),
        partyPhone: d.partyPhone || null,
        projectId: d.projectId || null,
        bookingId: d.bookingId || null,
        amount, mode: d.mode,
        reference: d.reference || null,
        narration: d.narration || null,
        materialName: d.materialName || null,
        quantity: d.quantity ?? null,
        unit: d.unit || null,
        rate: d.rate ?? null,
        gstRate: d.gstRate ?? null,
        gstAmount,
        createdById: ctx.user.id,
      },
    });

    await writeAudit({
      actorId: ctx.user.id, action: 'CREATE', entityType: 'Invoice', entityId: v.id,
      summary: `${meta.label} ${number} — ${d.partyName} — Rs ${amount.toLocaleString('en-IN')}`,
    });
    revalidatePath('/cash-book');
    return { ok: true, id: v.id, number, message: `${number} recorded.` };
  } catch (err) { return toActionError(err); }
}

/**
 * Cancel rather than delete. A cash book that can have entries removed is not
 * a cash book — the number stays, marked cancelled, with a reason.
 */
export async function cancelVoucher(id: string, reason: string): Promise<VoucherResult> {
  try {
    const ctx = await ensure('billing.invoice.manage');
    const v = await prisma.voucher.update({
      where: { id },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason.slice(0, 300) || 'No reason given' },
      select: { number: true },
    });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'Invoice', entityId: id, summary: `Cancelled voucher ${v.number}: ${reason.slice(0, 120)}` });
    revalidatePath('/cash-book');
    return { ok: true, message: `${v.number} cancelled. It stays in the book, marked cancelled.` };
  } catch (err) { return toActionError(err); }
}
