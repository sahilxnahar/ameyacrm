'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { GROUP_NAMES, VOUCHER_TYPES } from '@/config/tally-groups';
import { getTallyData, type TallyData } from '@/server/services/tally-service';
import { getCompanyDetails } from '@/server/services/company-service';
import { buildTallyStatementPdf, type StmtRow } from '@/lib/pdf/tally-statement-pdf';
import { ensure, toActionError } from './_helpers';

export type TallyResult = { ok: true; id?: string } | { error: string };

const inr = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Re-fetch all Tally data for a chosen period, for the on-screen reports. */
export async function tallyDataForPeriod(fromISO: string | null, toISO: string | null, label: string): Promise<{ ok: true; data: TallyData } | { error: string }> {
  try {
    await ensure('finance.ledger.view');
    const data = await getTallyData({ from: fromISO ? new Date(fromISO) : null, to: toISO ? new Date(toISO) : null, label });
    return { ok: true, data };
  } catch (e) { return toActionError(e); }
}

/** Build a branded PDF of a Tally financial statement for the CA. */
export async function tallyStatementPdf(kind: 'trial' | 'pl' | 'bs' | 'stock', fromISO?: string | null, toISO?: string | null, label?: string): Promise<{ ok: true; filename: string; pdfBase64: string } | { error: string }> {
  try {
    await ensure('finance.ledger.view');
    const [data, company] = await Promise.all([
      getTallyData({ from: fromISO ? new Date(fromISO) : null, to: toISO ? new Date(toISO) : null, label }),
      getCompanyDetails(),
    ]);
    const co = { name: company.legalName, registeredAddress: company.registeredAddress, phone: company.phone, email: company.email, website: company.website, gstin: company.gstin };
    const asOf = label && label !== 'All time' ? label : `As of ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}`;

    let title = '', subtitle = asOf, columns: { label: string; align?: 'left' | 'right'; weight?: number }[] = [], rows: StmtRow[] = [], filename = '';

    if (kind === 'trial') {
      title = 'Trial Balance';
      columns = [{ label: 'Ledger', weight: 3 }, { label: 'Group', weight: 3 }, { label: 'Debit', align: 'right', weight: 2 }, { label: 'Credit', align: 'right', weight: 2 }];
      rows = data.trial.rows.map((r) => ({ cells: [r.name, r.group, r.debit ? inr(r.debit) : '', r.credit ? inr(r.credit) : ''] }));
      rows.push({ kind: 'total', cells: ['Total', '', inr(data.trial.totalDebit), inr(data.trial.totalCredit)] });
      filename = 'Tally-Trial-Balance.pdf';
    } else if (kind === 'pl') {
      title = 'Profit & Loss A/c';
      columns = [{ label: 'Particulars', weight: 4 }, { label: 'Amount', align: 'right', weight: 2 }];
      rows = [
        { kind: 'head', cells: ['Income', ''] },
        ...data.pl.income.map((l) => ({ cells: [l.name, inr(l.amount)] })),
        { kind: 'total', cells: ['Total income', inr(data.pl.totalIncome)] },
        { kind: 'head', cells: ['Expenses', ''] },
        ...data.pl.expense.map((l) => ({ cells: [l.name, inr(l.amount)] })),
        { kind: 'total', cells: ['Total expenses', inr(data.pl.totalExpense)] },
        { kind: 'total', cells: [data.pl.profit >= 0 ? 'Net Profit' : 'Net Loss', inr(Math.abs(data.pl.profit))] },
      ];
      filename = 'Tally-Profit-and-Loss.pdf';
    } else if (kind === 'bs') {
      title = 'Balance Sheet';
      columns = [{ label: 'Particulars', weight: 4 }, { label: 'Amount', align: 'right', weight: 2 }];
      const assets = data.ledgers.filter((l) => l.nature === 'ASSET' && l.balance !== 0);
      const liabs = data.ledgers.filter((l) => l.nature === 'LIABILITY' && l.balance !== 0);
      const profit = data.pl.profit;
      const tl = liabs.reduce((s, l) => s + l.balance, 0) + profit;
      const ta = assets.reduce((s, l) => s + l.balance, 0);
      rows = [
        { kind: 'head', cells: ['Liabilities', ''] },
        ...liabs.map((l) => ({ cells: [l.name, inr(l.balance)] })),
        { cells: ['Profit & Loss A/c (current)', inr(profit)] },
        { kind: 'total', cells: ['Total liabilities', inr(tl)] },
        { kind: 'head', cells: ['Assets', ''] },
        ...assets.map((l) => ({ cells: [l.name, inr(l.balance)] })),
        { kind: 'total', cells: ['Total assets', inr(ta)] },
      ];
      filename = 'Tally-Balance-Sheet.pdf';
    } else {
      title = 'Stock Summary';
      columns = [{ label: 'Item', weight: 3 }, { label: 'Unit', weight: 1 }, { label: 'Inward', align: 'right', weight: 1.4 }, { label: 'Outward', align: 'right', weight: 1.4 }, { label: 'Closing', align: 'right', weight: 1.4 }, { label: 'Rate', align: 'right', weight: 1.4 }, { label: 'Value', align: 'right', weight: 1.6 }];
      rows = data.stock.map((s) => ({ cells: [s.name, s.unit, String(s.inQty), String(s.outQty), String(s.closingQty), inr(s.rate), inr(s.value)] }));
      rows.push({ kind: 'total', cells: ['Total', '', '', '', '', '', inr(data.stock.reduce((a, s) => a + s.value, 0))] });
      filename = 'Tally-Stock-Summary.pdf';
    }

    const bytes = await buildTallyStatementPdf({ company: co, title, subtitle, columns, rows });
    return { ok: true, filename, pdfBase64: Buffer.from(bytes).toString('base64') };
  } catch (e) { return toActionError(e); }
}

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

// ── Ledger drill-down ───────────────────────────────────────────────────────
export interface LedgerStmtLine { date: string; type: string; number: number; particulars: string; debit: number; credit: number; balance: number; balanceSide: 'Dr' | 'Cr' }
export type LedgerStmt = { ok: true; name: string; group: string; rows: LedgerStmtLine[]; closing: number; closingSide: 'Dr' | 'Cr' } | { error: string };

export async function tallyLedgerStatement(ledgerId: string): Promise<LedgerStmt> {
  try {
    await ensure('finance.ledger.view');
    const ledger = await prisma.tallyLedger.findUnique({ where: { id: ledgerId } });
    if (!ledger) return { error: 'Ledger not found.' };
    const lines = await prisma.tallyVoucherLine.findMany({
      where: { ledgerId },
      include: { voucher: { select: { date: true, type: true, number: true, lines: { include: { ledger: { select: { name: true } } } } } } },
      orderBy: [{ voucher: { date: 'asc' } }, { voucher: { number: 'asc' } }],
      take: 2000,
    });
    let running = ledger.openingSide === 'Dr' ? Number(ledger.openingBalance) : -Number(ledger.openingBalance);
    const rows: LedgerStmtLine[] = lines.map((ln) => {
      const debit = Number(ln.debit), credit = Number(ln.credit);
      running = Math.round((running + debit - credit) * 100) / 100;
      const particulars = ln.voucher.lines.filter((x) => x.ledger.name !== ledger.name).map((x) => x.ledger.name).join(', ') || ledger.name;
      return { date: ln.voucher.date.toISOString(), type: ln.voucher.type, number: ln.voucher.number, particulars, debit, credit, balance: Math.abs(running), balanceSide: running >= 0 ? 'Dr' : 'Cr' };
    });
    return { ok: true, name: ledger.name, group: ledger.group, rows, closing: Math.abs(running), closingSide: running >= 0 ? 'Dr' : 'Cr' };
  } catch (e) { const r = toActionError(e); return r; }
}

// ── Outstanding / bill-wise with FIFO ageing ────────────────────────────────
export interface AgedParty { name: string; total: number; b0: number; b30: number; b60: number; b90: number }
export type Outstanding = { ok: true; receivables: AgedParty[]; payables: AgedParty[]; totalReceivable: number; totalPayable: number } | { error: string };

function fifoAge(charges: Array<{ date: Date; amount: number }>, paymentsTotal: number, now: Date): { total: number; b0: number; b30: number; b60: number; b90: number } {
  const sorted = [...charges].sort((a, b) => a.date.getTime() - b.date.getTime());
  let pay = paymentsTotal;
  const out = { total: 0, b0: 0, b30: 0, b60: 0, b90: 0 };
  for (const c of sorted) {
    let rem = c.amount;
    if (pay > 0) { const used = Math.min(pay, rem); pay -= used; rem -= used; }
    if (rem <= 0.009) continue;
    out.total += rem;
    const age = Math.floor((now.getTime() - c.date.getTime()) / 86400000);
    if (age <= 30) out.b0 += rem; else if (age <= 60) out.b30 += rem; else if (age <= 90) out.b60 += rem; else out.b90 += rem;
  }
  const r2 = (x: number) => Math.round(x * 100) / 100;
  return { total: r2(out.total), b0: r2(out.b0), b30: r2(out.b30), b60: r2(out.b60), b90: r2(out.b90) };
}

export async function tallyOutstanding(): Promise<Outstanding> {
  try {
    await ensure('finance.ledger.view');
    const now = new Date();
    const parties = await prisma.tallyLedger.findMany({ where: { group: { in: ['Sundry Debtors', 'Sundry Creditors'] } } });
    if (parties.length === 0) return { ok: true, receivables: [], payables: [], totalReceivable: 0, totalPayable: 0 };
    const lines = await prisma.tallyVoucherLine.findMany({
      where: { ledgerId: { in: parties.map((p) => p.id) } },
      include: { voucher: { select: { date: true } } },
      take: 20000,
    });
    const byLedger = new Map<string, typeof lines>();
    for (const l of lines) { const a = byLedger.get(l.ledgerId) ?? []; a.push(l); byLedger.set(l.ledgerId, a); }

    const receivables: AgedParty[] = [], payables: AgedParty[] = [];
    for (const p of parties) {
      const isDebtor = p.group === 'Sundry Debtors';
      const mine = byLedger.get(p.id) ?? [];
      const charges: Array<{ date: Date; amount: number }> = [];
      let payments = 0;
      for (const l of mine) {
        const debit = Number(l.debit), credit = Number(l.credit);
        const chargeAmt = isDebtor ? debit : credit;
        const payAmt = isDebtor ? credit : debit;
        if (chargeAmt > 0) charges.push({ date: l.voucher.date, amount: chargeAmt });
        if (payAmt > 0) payments += payAmt;
      }
      const opening = Number(p.openingBalance);
      if (opening > 0) {
        const openIsCharge = (isDebtor && p.openingSide === 'Dr') || (!isDebtor && p.openingSide === 'Cr');
        if (openIsCharge) charges.push({ date: new Date(0), amount: opening }); else payments += opening;
      }
      const aged = fifoAge(charges, payments, now);
      if (aged.total <= 0.009) continue;
      (isDebtor ? receivables : payables).push({ name: p.name, ...aged });
    }
    receivables.sort((a, b) => b.total - a.total);
    payables.sort((a, b) => b.total - a.total);
    return {
      ok: true, receivables, payables,
      totalReceivable: Math.round(receivables.reduce((s, r) => s + r.total, 0) * 100) / 100,
      totalPayable: Math.round(payables.reduce((s, r) => s + r.total, 0) * 100) / 100,
    };
  } catch (e) { const r = toActionError(e); return r; }
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
