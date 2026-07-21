'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from '@/server/actions/_helpers';
import { KIND_META, VOUCHER_KINDS, PAY_MODES, type VoucherKind } from '@/config/vouchers';
import { describeUtr } from '@/lib/money-words';
import { extractPaymentAdvice, runAiSelfTest, isGeminiEnabled } from '@/lib/ai/gemini';
import { AI_SOURCES, reindexSource, type IndexReport } from '@/server/services/ai-index-service';

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
  utr: z.string().max(40).optional().or(z.literal('')),
  paidOn: z.string().optional().or(z.literal('')),
  bankName: z.string().max(80).optional().or(z.literal('')),
  narration: z.string().max(500).optional().or(z.literal('')),
  materialName: z.string().max(160).optional().or(z.literal('')),
  quantity: z.coerce.number().min(0).optional(),
  unit: z.string().max(20).optional().or(z.literal('')),
  rate: z.coerce.number().min(0).optional(),
  gstRate: z.coerce.number().min(0).max(30).optional(),
});

export async function createVoucher(input: unknown): Promise<VoucherResult> {
  try {
    const ctx = await ensure('finance.ledger.manage');
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
        utr: d.utr ? d.utr.replace(/[^A-Za-z0-9]/g, '').toUpperCase() : null,
        paidOn: d.paidOn ? new Date(d.paidOn) : null,
        bankName: d.bankName || null,
        utrEnteredById: d.utr ? ctx.user.id : null,
        utrEnteredAt: d.utr ? new Date() : null,
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
    const ctx = await ensure('finance.ledger.manage');
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


const utrSchema = z.object({
  id: z.string().min(1),
  utr: z.string().min(4, 'A UTR is at least 4 characters.').max(40),
  paidOn: z.string().optional().or(z.literal('')),
  bankName: z.string().max(80).optional().or(z.literal('')),
});

/**
 * Attach the bank trail to a voucher after the fact — most payments are
 * entered when they are decided, and the UTR only exists once the transfer
 * actually goes through.
 */
export async function recordUtr(input: unknown): Promise<VoucherResult> {
  try {
    const ctx = await ensure('finance.ledger.manage');
    const d = utrSchema.parse(input);
    const utr = d.utr.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

    const shape = describeUtr(utr);
    if (!shape.ok) return { error: shape.note ?? 'That does not look like a UTR.' };

    const v = await prisma.voucher.findUnique({ where: { id: d.id }, select: { number: true, status: true } });
    if (!v) return { error: 'That voucher no longer exists.' };
    if (v.status === 'CANCELLED') return { error: `${v.number} is cancelled — reverse it instead of adding a UTR.` };

    const clash = await prisma.voucher.findFirst({
      where: { utr, id: { not: d.id }, status: { not: 'CANCELLED' } },
      select: { number: true, partyName: true },
    });
    if (clash) return { error: `That UTR is already on ${clash.number} (${clash.partyName}). One transfer, one voucher.` };

    await prisma.voucher.update({
      where: { id: d.id },
      data: {
        utr,
        paidOn: d.paidOn ? new Date(d.paidOn) : new Date(),
        bankName: d.bankName || null,
        utrEnteredById: ctx.user.id,
        utrEnteredAt: new Date(),
      },
    });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'Voucher', entityId: d.id, summary: `UTR ${utr} recorded on ${v.number}` });
    revalidatePath('/payments');
    revalidatePath('/cash-book');
    return { ok: true, number: v.number, message: shape.note ?? `Recorded${shape.rail ? ` — looks like ${shape.rail}` : ''}.` };
  } catch (e) {
    return toActionError(e);
  }
}

export type AdviceResult =
  | { ok: true; partyName: string | null; amount: number | null; paidOn: string | null; utr: string | null; mode: string | null; bankName: string | null; narration: string | null; confidence: string; warning: string | null }
  | { error: string };

/** Read a pasted bank SMS / UPI confirmation and hand back the fields to fill in. */
export async function readPaymentAdvice(text: string): Promise<AdviceResult> {
  try {
    await ensure('finance.ledger.manage');
    if (!isGeminiEnabled()) return { error: 'The AI key is not set up yet — check Admin > AI health.' };
    if (!text || text.trim().length < 10) return { error: 'Paste the whole bank message so there is something to read.' };

    const r = await extractPaymentAdvice({ text });
    if (!r) return { error: 'The AI could not read that. Check Admin > AI health, or type the details in by hand.' };
    if (!r.amount && !r.utr) return { error: 'No amount or UTR could be found in that text. Is it definitely a payment confirmation?' };

    let warning: string | null = null;
    if (r.utr) {
      const shape = describeUtr(r.utr);
      if (shape.note) warning = shape.note;
      const clash = await prisma.voucher.findFirst({ where: { utr: r.utr, status: { not: 'CANCELLED' } }, select: { number: true, partyName: true } });
      if (clash) warning = `Careful — that UTR is already recorded on ${clash.number} (${clash.partyName}).`;
    }
    if (r.confidence === 'low' && !warning) warning = 'Read with low confidence — please check each field before saving.';

    return { ok: true, ...r, warning };
  } catch (e) {
    return toActionError(e);
  }
}

/** Run the live AI probes. Admin-only: it spends real quota. */
export async function checkAiHealth() {
  await ensure('admin.setting.manage');
  return runAiSelfTest();
}

/** Re-index every source the AI can learn from. Super Admin only: it costs quota. */
export async function reindexEverything(): Promise<{ reports: IndexReport[] }> {
  const ctx = await ensure('admin.setting.manage');
  const reports: IndexReport[] = [];
  for (const s of AI_SOURCES) reports.push(await reindexSource(s.key));
  await writeAudit({
    actorId: ctx.user.id, action: 'UPDATE', entityType: 'System',
    summary: `AI re-index: ${reports.reduce((n, r) => n + r.indexed, 0)} records`,
  });
  return { reports };
}

/** Go back for files uploaded while the AI was unavailable. Admin only. */
export async function catchUpSummaries(): Promise<{ summarised: number; indexed: number; remaining: number; message: string }> {
  const ctx = await ensure('admin.setting.manage');
  const { summariseMissing } = await import('@/server/services/file-sync-service');
  const r = await summariseMissing(12);
  await writeAudit({
    actorId: ctx.user.id, action: 'UPDATE', entityType: 'Document',
    summary: `Catch-up summaries: ${r.summarised} files`,
  });
  return { summarised: r.summarised, indexed: r.indexed, remaining: r.remaining, message: r.message };
}
