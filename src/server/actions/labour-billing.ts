'use server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from './_helpers';
import { postVoucherById } from '@/lib/ledger/post-voucher';
import { needsPaymentApproval, notifyPaymentApprovers } from '@/server/services/payment-approval-service';
import { nextVoucherNumber } from '@/lib/db/voucher-number';

function num(n?: number | null): number { return n != null && Number.isFinite(n) ? n : 0; }

// ── Module 66: Piece-rate labour billing ─────────────────────────────────────
export interface PieceRateInput { projectId: string; vendorId?: string | null; workItem: string; unit?: string; quantity: number; ratePerUnit: number }
export async function savePieceRateEntry(input: PieceRateInput): Promise<{ ok: true; id: string } | { error: string }> {
  try {
    await ensure('procurement.manage');
    if (!input.projectId || !input.workItem?.trim()) return { error: 'Project and work item are required.' };
    const quantity = num(input.quantity), ratePerUnit = num(input.ratePerUnit);
    const amount = Math.round(quantity * ratePerUnit * 100) / 100;
    const row = await prisma.pieceRateEntry.create({
      data: { projectId: input.projectId, vendorId: input.vendorId || null, workItem: input.workItem.trim(), unit: (input.unit || 'SQFT').trim(), quantity, ratePerUnit, amount },
    });
    await writeAudit({ action: 'CREATE', entityType: 'PieceRateEntry', entityId: row.id, summary: `Piece-rate ${input.workItem}: ${quantity} ${input.unit || 'SQFT'} × ₹${ratePerUnit} = ₹${amount}` });
    revalidatePath('/piece-rate');
    return { ok: true, id: row.id };
  } catch (err) { return toActionError(err); }
}

/** Settle a piece-rate entry — raises a CP- payment voucher (money on the spine). */
export async function settlePieceRate(id: string): Promise<{ ok: true; voucher: string } | { error: string }> {
  try {
    const ctx = await ensure('finance.ledger.manage');
    const entry = await prisma.pieceRateEntry.findUnique({ where: { id }, select: { id: true, amount: true, workItem: true, vendorId: true, projectId: true, voucherId: true } });
    if (!entry) return { error: 'Entry not found.' };
    if (entry.voucherId) {
      // Same rule as an RA bill: a cancelled or rejected settlement leaves the
      // entry payable again, so the link alone must not lock it out for ever.
      const held = await prisma.voucher.findUnique({ where: { id: entry.voucherId }, select: { status: true, number: true } });
      if (held && held.status !== 'CANCELLED') {
        return { error: held.status === 'DRAFT' ? `Settlement ${held.number} is already raised and waiting for approval.` : 'Already settled.' };
      }
    }
    const vendor = entry.vendorId ? await prisma.vendor.findUnique({ where: { id: entry.vendorId }, select: { name: true, isActive: true } }) : null;
    if (vendor && !vendor.isActive) return { error: 'Vendor is deactivated (possibly frozen) — cannot settle.' };
    const needsApproval = await needsPaymentApproval(Number(entry.amount));
    const voucher = await prisma.voucher.create({
      data: { number: await nextVoucherNumber('CP'), kind: 'BANK_PAID', status: needsApproval ? 'DRAFT' : 'POSTED', voucherDate: new Date(), partyName: vendor?.name ?? 'Sub-contractor', vendorId: entry.vendorId, projectId: entry.projectId, amount: Number(entry.amount), mode: 'BANK_TRANSFER', narration: `Piece-rate: ${entry.workItem}`, accountCode: '5450', createdById: ctx.user.id },
    });
    await prisma.pieceRateEntry.update({ where: { id }, data: { voucherId: voucher.id } });
    if (needsApproval) await notifyPaymentApprovers(voucher.id, ctx.user.id, `${voucher.number} · ${vendor?.name ?? 'Sub-contractor'} · Rs ${Number(entry.amount).toLocaleString('en-IN')}`);
    else await postVoucherById(voucher.id, ctx.user.id);
    await writeAudit({ action: 'CREATE', entityType: 'Voucher', entityId: voucher.id, summary: `Piece-rate settled → ${voucher.number} (₹${Number(entry.amount)})` });
    revalidatePath('/piece-rate');
    return { ok: true, voucher: voucher.number };
  } catch (err) { return toActionError(err); }
}

// ── Module 69: Sub-contractor default registry ───────────────────────────────
export interface VendorDefaultInput { vendorId: string; projectId?: string | null; kind: string; severity?: string; note?: string | null }
export async function reportVendorDefault(input: VendorDefaultInput): Promise<{ ok: true } | { error: string }> {
  try {
    await ensure('procurement.manage');
    if (!input.vendorId || !input.kind?.trim()) return { error: 'Vendor and default type are required.' };
    const severity = ['LOW', 'MEDIUM', 'HIGH', 'BLACKLIST'].includes(input.severity ?? '') ? input.severity! : 'MEDIUM';
    await prisma.vendorDefault.create({ data: { vendorId: input.vendorId, projectId: input.projectId || null, kind: input.kind.trim(), severity, note: input.note?.trim() || null } });
    // A blacklist deactivates the vendor everywhere — cross-project enforcement.
    if (severity === 'BLACKLIST') await prisma.vendor.update({ where: { id: input.vendorId }, data: { isActive: false } }).catch(() => undefined);
    await writeAudit({ action: 'CREATE', entityType: 'VendorDefault', entityId: input.vendorId, summary: `Default logged (${severity}): ${input.kind}` });
    revalidatePath('/vendor-registry');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}
