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

const stockSchema = z.object({
  name: z.string().min(1, 'Name is required').max(120),
  unit: z.string().max(20).default('Nos'),
  hsn: z.string().max(20).optional(),
  gstRate: z.coerce.number().min(0).max(28).default(0),
  openingQty: z.coerce.number().min(0).default(0),
  openingRate: z.coerce.number().min(0).default(0),
});

/** Create a stock item master. */
export async function createTallyStockItem(input: unknown): Promise<TallyResult> {
  try {
    const ctx = await ensure('finance.ledger.view');
    const d = stockSchema.parse(input);
    const exists = await prisma.tallyStockItem.findUnique({ where: { name: d.name }, select: { id: true } });
    if (exists) return { error: 'A stock item with that name already exists.' };
    const it = await prisma.tallyStockItem.create({ data: { name: d.name.trim(), unit: d.unit || 'Nos', hsn: d.hsn || null, gstRate: d.gstRate, openingQty: d.openingQty, openingRate: d.openingRate } });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'TallyStockItem', entityId: it.id, summary: `Tally stock item ${d.name}` });
    revalidatePath('/tally');
    return { ok: true, id: it.id };
  } catch (e) { return toActionError(e); }
}

/** Find or create a system trading/GST ledger by name. */
async function ledgerByName(name: string, group: string): Promise<string> {
  const found = await prisma.tallyLedger.findUnique({ where: { name }, select: { id: true } });
  if (found) return found.id;
  const created = await prisma.tallyLedger.create({ data: { name, group, isSystem: true } });
  return created.id;
}

const invoiceSchema = z.object({
  type: z.enum(['Sales', 'Purchase']),
  date: z.string().min(1),
  partyLedgerId: z.string().min(1, 'Choose a party ledger'),
  narration: z.string().max(500).optional(),
  items: z.array(z.object({ itemId: z.string().min(1), qty: z.coerce.number().positive(), rate: z.coerce.number().min(0) })).min(1, 'Add at least one item'),
});

/**
 * Post a Sales or Purchase item invoice. Computes GST per item and auto-posts the
 * correct double-entry: a sale debits the party and credits Sales + Output GST;
 * a purchase debits Purchase + Input GST and credits the party. Also records the
 * stock movement (out on a sale, in on a purchase).
 */
export async function createTallyItemInvoice(input: unknown): Promise<TallyResult> {
  try {
    const ctx = await ensure('finance.ledger.view');
    const d = invoiceSchema.parse(input);
    const items = await prisma.tallyStockItem.findMany({ where: { id: { in: d.items.map((i) => i.itemId) } }, select: { id: true, gstRate: true } });
    const gstOf = new Map(items.map((i) => [i.id, Number(i.gstRate)]));

    const r2 = (x: number) => Math.round(x * 100) / 100;
    let taxable = 0, gst = 0;
    const invLines = d.items.map((i) => {
      const amount = r2(i.qty * i.rate);
      taxable += amount;
      gst += r2((amount * (gstOf.get(i.itemId) ?? 0)) / 100);
      return { itemId: i.itemId, qty: i.qty, rate: i.rate, amount, direction: d.type === 'Sales' ? 'OUT' : 'IN' };
    });
    taxable = r2(taxable); gst = r2(gst);
    const total = r2(taxable + gst);
    if (total <= 0) return { error: 'The invoice total cannot be zero.' };

    const salesId = await ledgerByName('Sales', 'Sales Accounts');
    const purchaseId = await ledgerByName('Purchase', 'Purchase Accounts');
    const outGstId = await ledgerByName('Output GST', 'Duties & Taxes');
    const inGstId = await ledgerByName('Input GST', 'Duties & Taxes');

    const lines: Array<{ ledgerId: string; debit: number; credit: number }> = [];
    if (d.type === 'Sales') {
      lines.push({ ledgerId: d.partyLedgerId, debit: total, credit: 0 });
      lines.push({ ledgerId: salesId, debit: 0, credit: taxable });
      if (gst > 0) lines.push({ ledgerId: outGstId, debit: 0, credit: gst });
    } else {
      lines.push({ ledgerId: purchaseId, debit: taxable, credit: 0 });
      if (gst > 0) lines.push({ ledgerId: inGstId, debit: gst, credit: 0 });
      lines.push({ ledgerId: d.partyLedgerId, debit: 0, credit: total });
    }

    const last = await prisma.tallyVoucher.findFirst({ where: { type: d.type }, orderBy: { number: 'desc' }, select: { number: true } });
    const number = (last?.number ?? 0) + 1;

    const v = await prisma.tallyVoucher.create({
      data: {
        type: d.type, number, date: new Date(d.date), narration: d.narration || null, createdById: ctx.user.id,
        lines: { create: lines },
        inventoryLines: { create: invLines },
      },
      select: { id: true },
    });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'TallyVoucher', entityId: v.id, summary: `Tally ${d.type} invoice #${number} — Rs ${total.toLocaleString('en-IN')} (GST ${gst.toLocaleString('en-IN')})` });
    revalidatePath('/tally');
    return { ok: true, id: v.id };
  } catch (e) { return toActionError(e); }
}

export async function deleteTallyStockItem(id: string): Promise<TallyResult> {
  try {
    const ctx = await ensure('finance.ledger.view');
    const it = await prisma.tallyStockItem.findUnique({ where: { id }, select: { name: true, _count: { select: { lines: true } } } });
    if (!it) return { error: 'Item not found.' };
    if (it._count.lines > 0) return { error: 'This item has movements — delete those invoices first.' };
    await prisma.tallyStockItem.delete({ where: { id } });
    await writeAudit({ actorId: ctx.user.id, action: 'DELETE', entityType: 'TallyStockItem', entityId: id, summary: `Deleted Tally stock item ${it.name}` });
    revalidatePath('/tally');
    return { ok: true };
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
