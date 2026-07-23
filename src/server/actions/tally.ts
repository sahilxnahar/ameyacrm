'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { GROUP_NAMES, VOUCHER_TYPES, natureOfGroup } from '@/config/tally-groups';
import { getTallyData, type TallyData } from '@/server/services/tally-service';
import { getCompanyDetails } from '@/server/services/company-service';
import { buildTallyStatementPdf, type StmtRow } from '@/lib/pdf/tally-statement-pdf';
import { buildTallyInvoicePdf } from '@/lib/pdf/tally-invoice-pdf';
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

const tallyPrefsSchema = z.object({
  companyName: z.string().max(80).optional(),
  defaultVoucher: z.enum(VOUCHER_TYPES as unknown as [string, ...string[]]).optional(),
  defaultPeriod: z.enum(['month', 'quarter', 'fy', 'all']).optional(),
  os: z.enum(['auto', 'mac', 'windows']).optional(),
});

/** Save this user's personal Ameya Tally preferences (company name, defaults, OS for shortcuts). */
export async function saveTallyPrefs(input: unknown): Promise<TallyResult> {
  try {
    const ctx = await ensure('finance.ledger.view');
    const d = tallyPrefsSchema.parse(input);
    const clean = {
      companyName: (d.companyName ?? '').trim().slice(0, 80) || 'Ameya Heights LLP',
      defaultVoucher: d.defaultVoucher ?? 'Payment',
      defaultPeriod: d.defaultPeriod ?? 'all',
      os: d.os ?? 'auto',
    };
    await prisma.user.update({ where: { id: ctx.user.id }, data: { tallyPrefs: clean } });
    revalidatePath('/tally');
    return { ok: true };
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
  costCentre: z.string().max(120).optional(),
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
        costCentre: d.costCentre?.trim() || null,
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
  costCentre: z.string().max(120).optional(),
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
        type: d.type, number, date: new Date(d.date), narration: d.narration || null, costCentre: d.costCentre?.trim() || null, createdById: ctx.user.id,
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

// ── Cost centres / job costing ──────────────────────────────────────────────
export async function createTallyCostCentre(name: unknown): Promise<TallyResult> {
  try {
    const ctx = await ensure('finance.ledger.view');
    const nm = z.string().min(1, 'Name is required').max(120).parse(name).trim();
    const exists = await prisma.tallyCostCentre.findUnique({ where: { name: nm }, select: { id: true } });
    if (exists) return { error: 'That cost centre already exists.' };
    const c = await prisma.tallyCostCentre.create({ data: { name: nm } });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'TallyCostCentre', entityId: c.id, summary: `Tally cost centre ${nm}` });
    revalidatePath('/tally');
    return { ok: true, id: c.id };
  } catch (e) { return toActionError(e); }
}

export interface CostCentreRow { name: string; income: number; expense: number; profit: number }
export type CostReport = { ok: true; rows: CostCentreRow[] } | { error: string };

/** Per-cost-centre profit & loss for the period — job costing (Project A vs B). */
export async function tallyCostCentreReport(fromISO: string | null, toISO: string | null): Promise<CostReport> {
  try {
    await ensure('finance.ledger.view');
    const from = fromISO ? new Date(fromISO) : null;
    const to = toISO ? new Date(toISO) : new Date('9999-12-31T00:00:00.000Z');
    const lines = await prisma.tallyVoucherLine.findMany({
      where: { voucher: { date: from ? { gte: from, lte: to } : { lte: to } } },
      include: { voucher: { select: { costCentre: true } }, ledger: { select: { group: true } } },
      take: 50000,
    });
    const map = new Map<string, { income: number; expense: number }>();
    for (const l of lines) {
      const nat = natureOfGroup(l.ledger.group);
      if (nat !== 'INCOME' && nat !== 'EXPENSE') continue;
      const cc = l.voucher.costCentre ?? 'Unallocated';
      const e = map.get(cc) ?? { income: 0, expense: 0 };
      const debit = Number(l.debit), credit = Number(l.credit);
      if (nat === 'INCOME') e.income += credit - debit; else e.expense += debit - credit;
      map.set(cc, e);
    }
    const r2 = (x: number) => Math.round(x * 100) / 100;
    const rows: CostCentreRow[] = [...map.entries()]
      .map(([name, v]) => ({ name, income: r2(v.income), expense: r2(v.expense), profit: r2(v.income - v.expense) }))
      .filter((r) => r.income !== 0 || r.expense !== 0)
      .sort((a, b) => b.profit - a.profit);
    return { ok: true, rows };
  } catch (e) { const r = toActionError(e); return r; }
}

// ── GST returns (offline summary) ───────────────────────────────────────────
export interface GstRateRow { rate: number; taxable: number; cgst: number; sgst: number; totalTax: number }
export interface GstHsnRow { hsn: string; rate: number; qty: number; taxable: number; tax: number }
export interface GstReturns {
  ok: true;
  gstr1: GstRateRow[];
  gstr1Total: { taxable: number; cgst: number; sgst: number; totalTax: number };
  gstr3b: {
    outwardTaxable: number; outputCgst: number; outputSgst: number; outputTax: number;
    inwardTaxable: number; inputCgst: number; inputSgst: number; inputTax: number;
    netCgst: number; netSgst: number; netPayable: number;
  };
  itc: GstRateRow[];
  hsn: GstHsnRow[];
}

/**
 * Offline GST return summary computed from item invoices. GSTR-1 is outward
 * supplies grouped by tax rate; GSTR-3B nets output tax against input tax credit.
 * Tax is split CGST/SGST assuming intra-state supply — for inter-state (IGST)
 * or filing-ready JSON, use the connected GST tier. Always have your CA review.
 */
export async function tallyGstReturns(fromISO: string | null, toISO: string | null): Promise<GstReturns | { error: string }> {
  try {
    await ensure('finance.ledger.view');
    const from = fromISO ? new Date(fromISO) : null;
    const to = toISO ? new Date(toISO) : new Date('9999-12-31T00:00:00.000Z');
    const lines = await prisma.tallyInventoryLine.findMany({
      where: { voucher: { date: from ? { gte: from, lte: to } : { lte: to } } },
      include: { item: { select: { gstRate: true, hsn: true } } },
      take: 50000,
    });
    const r2 = (x: number) => Math.round(x * 100) / 100;
    const outMap = new Map<number, number>(); // rate -> taxable
    const inMap = new Map<number, number>();
    // HSN-wise summary of outward supplies (GSTR-1 table 12).
    const hsnMap = new Map<string, { rate: number; qty: number; taxable: number }>();
    for (const l of lines) {
      const rate = Number(l.item.gstRate);
      const amt = Number(l.amount);
      const m = l.direction === 'OUT' ? outMap : inMap;
      m.set(rate, (m.get(rate) ?? 0) + amt);
      if (l.direction === 'OUT') {
        const key = `${l.item.hsn || '—'}|${rate}`;
        const e = hsnMap.get(key) ?? { rate, qty: 0, taxable: 0 };
        e.qty += Number(l.qty); e.taxable += amt;
        hsnMap.set(key, e);
      }
    }
    const hsn: GstHsnRow[] = [...hsnMap.entries()]
      .map(([key, v]) => ({ hsn: key.split('|')[0]!, rate: v.rate, qty: r2(v.qty), taxable: r2(v.taxable), tax: r2((v.taxable * v.rate) / 100) }))
      .sort((a, b) => b.taxable - a.taxable);
    const toRows = (m: Map<number, number>): GstRateRow[] => [...m.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([rate, taxable]) => {
        const tax = r2((taxable * rate) / 100);
        const half = r2(tax / 2);
        return { rate, taxable: r2(taxable), cgst: half, sgst: r2(tax - half), totalTax: tax };
      });
    const gstr1 = toRows(outMap);
    const itc = toRows(inMap);
    const sum = (rows: GstRateRow[]) => rows.reduce((a, r) => ({ taxable: a.taxable + r.taxable, cgst: a.cgst + r.cgst, sgst: a.sgst + r.sgst, totalTax: a.totalTax + r.totalTax }), { taxable: 0, cgst: 0, sgst: 0, totalTax: 0 });
    const o = sum(gstr1); const i = sum(itc);
    return {
      ok: true,
      gstr1,
      gstr1Total: { taxable: r2(o.taxable), cgst: r2(o.cgst), sgst: r2(o.sgst), totalTax: r2(o.totalTax) },
      itc,
      gstr3b: {
        outwardTaxable: r2(o.taxable), outputCgst: r2(o.cgst), outputSgst: r2(o.sgst), outputTax: r2(o.totalTax),
        inwardTaxable: r2(i.taxable), inputCgst: r2(i.cgst), inputSgst: r2(i.sgst), inputTax: r2(i.totalTax),
        netCgst: r2(o.cgst - i.cgst), netSgst: r2(o.sgst - i.sgst), netPayable: r2(o.totalTax - i.totalTax),
      },
      hsn,
    };
  } catch (e) { const r = toActionError(e); return r; }
}

// ── Cash Flow & Funds Flow ──────────────────────────────────────────────────
export interface FlowRow { name: string; group: string; amount: number }
export interface FlowStatements {
  ok: true;
  cash: {
    opening: number; closing: number; net: number;
    inflows: FlowRow[]; outflows: FlowRow[]; totalIn: number; totalOut: number;
  };
  funds: {
    sources: FlowRow[]; applications: FlowRow[]; totalSources: number; totalApplications: number;
  };
}

const CASH_BANK_GROUPS = ['Cash-in-Hand', 'Bank Accounts', 'Bank OD A/c'];

/** Cash Flow (movement of cash & bank) and Funds Flow (sources vs applications). */
export async function tallyFlows(fromISO: string | null, toISO: string | null): Promise<FlowStatements | { error: string }> {
  try {
    await ensure('finance.ledger.view');
    const from = fromISO ? new Date(fromISO) : null;
    const to = toISO ? new Date(toISO) : new Date('9999-12-31T00:00:00.000Z');
    const r2 = (x: number) => Math.round(x * 100) / 100;

    const ledgers = await prisma.tallyLedger.findMany();
    const cashIds = new Set(ledgers.filter((l) => CASH_BANK_GROUPS.includes(l.group)).map((l) => l.id));
    const ledgerById = new Map(ledgers.map((l) => [l.id, l]));
    const openSigned = (l: (typeof ledgers)[number]) => (l.openingSide === 'Dr' ? Number(l.openingBalance) : -Number(l.openingBalance));

    // Movements strictly before the period (for opening balances) and up to `to` (for closing).
    const [beforeMov, closeMov] = await Promise.all([
      from ? prisma.tallyVoucherLine.groupBy({ by: ['ledgerId'], where: { voucher: { date: { lt: from } } }, _sum: { debit: true, credit: true } }) : Promise.resolve([] as Array<{ ledgerId: string; _sum: { debit: unknown; credit: unknown } }>),
      prisma.tallyVoucherLine.groupBy({ by: ['ledgerId'], where: { voucher: { date: { lte: to } } }, _sum: { debit: true, credit: true } }),
    ]);
    const beforeOf = new Map(beforeMov.map((m) => [m.ledgerId, Number(m._sum.debit ?? 0) - Number(m._sum.credit ?? 0)]));
    const closeOf = new Map(closeMov.map((m) => [m.ledgerId, Number(m._sum.debit ?? 0) - Number(m._sum.credit ?? 0)]));

    // Cash & bank opening/closing.
    let cashOpen = 0, cashClose = 0;
    for (const l of ledgers) {
      if (!cashIds.has(l.id)) continue;
      cashOpen += openSigned(l) + (beforeOf.get(l.id) ?? 0);
      cashClose += openSigned(l) + (closeOf.get(l.id) ?? 0);
    }

    // Cash flow detail — in-period vouchers that touch cash/bank; attribute to counterparties.
    const periodVouchers = await prisma.tallyVoucher.findMany({
      where: { date: from ? { gte: from, lte: to } : { lte: to } },
      include: { lines: true },
      take: 50000,
    });
    const inflowMap = new Map<string, number>(), outflowMap = new Map<string, number>();
    for (const v of periodVouchers) {
      const touchesCash = v.lines.some((l) => cashIds.has(l.ledgerId));
      if (!touchesCash) continue;
      for (const l of v.lines) {
        if (cashIds.has(l.ledgerId)) continue; // counterparties only
        const credit = Number(l.credit), debit = Number(l.debit);
        if (credit > 0) inflowMap.set(l.ledgerId, (inflowMap.get(l.ledgerId) ?? 0) + credit);
        if (debit > 0) outflowMap.set(l.ledgerId, (outflowMap.get(l.ledgerId) ?? 0) + debit);
      }
    }
    const toFlowRows = (m: Map<string, number>): FlowRow[] => [...m.entries()]
      .map(([id, amt]) => ({ name: ledgerById.get(id)?.name ?? '?', group: ledgerById.get(id)?.group ?? '', amount: r2(amt) }))
      .filter((r) => r.amount > 0.009)
      .sort((a, b) => b.amount - a.amount);
    const inflows = toFlowRows(inflowMap), outflows = toFlowRows(outflowMap);
    const totalIn = r2(inflows.reduce((s, r) => s + r.amount, 0));
    const totalOut = r2(outflows.reduce((s, r) => s + r.amount, 0));

    // Funds flow — movement of each non-P&L ledger over the period, classed as source or application.
    const sources: FlowRow[] = [], applications: FlowRow[] = [];
    for (const l of ledgers) {
      const nat = natureOfGroup(l.group);
      if (nat === 'INCOME' || nat === 'EXPENSE') continue; // captured via profit
      const open = openSigned(l) + (from ? (beforeOf.get(l.id) ?? 0) : 0);
      const close = openSigned(l) + (closeOf.get(l.id) ?? 0);
      const delta = r2(close - open); // Dr-positive change
      if (Math.abs(delta) < 0.01) continue;
      if (nat === 'ASSET') {
        if (delta > 0) applications.push({ name: l.name, group: l.group, amount: delta });
        else sources.push({ name: l.name, group: l.group, amount: -delta });
      } else { // LIABILITY (incl. capital, reserves)
        if (delta < 0) sources.push({ name: l.name, group: l.group, amount: -delta });
        else applications.push({ name: l.name, group: l.group, amount: delta });
      }
    }
    // Net profit for the period is a source of funds (loss = application).
    const plSums = await prisma.tallyVoucherLine.groupBy({ by: ['ledgerId'], where: { voucher: { date: from ? { gte: from, lte: to } : { lte: to } } }, _sum: { debit: true, credit: true } });
    let profit = 0;
    for (const m of plSums) {
      const l = ledgerById.get(m.ledgerId); if (!l) continue;
      const nat = natureOfGroup(l.group);
      if (nat !== 'INCOME' && nat !== 'EXPENSE') continue;
      const d = Number(m._sum.debit ?? 0), c = Number(m._sum.credit ?? 0);
      profit += nat === 'INCOME' ? c - d : -(d - c);
    }
    profit = r2(profit);
    if (profit > 0.009) sources.push({ name: 'Profit for the period', group: 'Profit & Loss', amount: profit });
    else if (profit < -0.009) applications.push({ name: 'Loss for the period', group: 'Profit & Loss', amount: -profit });
    sources.sort((a, b) => b.amount - a.amount);
    applications.sort((a, b) => b.amount - a.amount);

    return {
      ok: true,
      cash: { opening: r2(cashOpen), closing: r2(cashClose), net: r2(cashClose - cashOpen), inflows, outflows, totalIn, totalOut },
      funds: {
        sources, applications,
        totalSources: r2(sources.reduce((s, r) => s + r.amount, 0)),
        totalApplications: r2(applications.reduce((s, r) => s + r.amount, 0)),
      },
    };
  } catch (e) { const r = toActionError(e); return r; }
}

// ── Ratio analysis ──────────────────────────────────────────────────────────
export interface RatioRow { name: string; value: string; hint: string }
export type Ratios = { ok: true; rows: RatioRow[]; asOf: string } | { error: string };

const CURRENT_ASSET_GROUPS = ['Current Assets', 'Cash-in-Hand', 'Bank Accounts', 'Sundry Debtors', 'Stock-in-Hand', 'Loans & Advances (Asset)', 'Deposits (Asset)'];
const CURRENT_LIAB_GROUPS = ['Current Liabilities', 'Sundry Creditors', 'Duties & Taxes', 'Provisions', 'Bank OD A/c'];
const DEBT_GROUPS = ['Secured Loans', 'Unsecured Loans', 'Loans (Liability)'];
const EQUITY_GROUPS = ['Capital Account', 'Reserves & Surplus'];

/** Key accounting ratios, Tally-style, from the balance sheet & P&L for the period. */
export async function tallyRatios(fromISO: string | null, toISO: string | null, label?: string): Promise<Ratios> {
  try {
    await ensure('finance.ledger.view');
    const data = await getTallyData({ from: fromISO ? new Date(fromISO) : null, to: toISO ? new Date(toISO) : null, label });
    const sumGroups = (groups: string[]) => data.ledgers.filter((l) => groups.includes(l.group)).reduce((s, l) => s + l.balance, 0);
    const r2 = (x: number) => Math.round(x * 100) / 100;
    const ca = sumGroups(CURRENT_ASSET_GROUPS);
    const cl = sumGroups(CURRENT_LIAB_GROUPS);
    const stock = data.stock.reduce((s, r) => s + r.value, 0);
    const debt = sumGroups(DEBT_GROUPS);
    const equity = sumGroups(EQUITY_GROUPS) + data.pl.profit;
    const debtors = data.ledgers.filter((l) => l.group === 'Sundry Debtors').reduce((s, l) => s + l.balance, 0);
    const creditors = data.ledgers.filter((l) => l.group === 'Sundry Creditors').reduce((s, l) => s + l.balance, 0);
    const income = data.pl.totalIncome, profit = data.pl.profit;
    const capitalEmployed = equity + debt;

    const money = (x: number) => `₹ ${inr(r2(x))}`;
    const times = (num: number, den: number) => (den > 0.009 ? `${(num / den).toFixed(2)} : 1` : '—');
    const pct = (num: number, den: number) => (Math.abs(den) > 0.009 ? `${r2((num / den) * 100).toFixed(2)} %` : '—');

    const rows: RatioRow[] = [
      { name: 'Working Capital', value: money(ca - cl), hint: 'Current Assets − Current Liabilities' },
      { name: 'Current Ratio', value: times(ca, cl), hint: 'Current Assets ÷ Current Liabilities (2:1 is healthy)' },
      { name: 'Quick Ratio', value: times(ca - stock, cl), hint: '(Current Assets − Stock) ÷ Current Liabilities (1:1 is healthy)' },
      { name: 'Debt-Equity Ratio', value: times(debt, equity), hint: 'Loans ÷ (Capital + Reserves + Profit)' },
      { name: 'Net Profit %', value: pct(profit, income), hint: 'Net Profit ÷ Income for the period' },
      { name: 'Return on Capital Employed', value: pct(profit, capitalEmployed), hint: 'Net Profit ÷ (Equity + Debt)' },
      { name: 'Sundry Debtors (receivable)', value: money(debtors), hint: 'Money owed to you' },
      { name: 'Sundry Creditors (payable)', value: money(creditors), hint: 'Money you owe' },
      { name: 'Closing Stock value', value: money(stock), hint: 'Inventory on hand at cost' },
    ];
    const asOf = data.period.label && data.period.label !== 'All time' ? data.period.label : `As of ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`;
    return { ok: true, rows, asOf };
  } catch (e) { const r = toActionError(e); return r; }
}

// ── Schedule III (Companies Act, Division I) statement ──────────────────────
export interface SchHead { label: string; amount: number }
export interface SchSection { title: string; heads: SchHead[]; total: number }
export type ScheduleIII = { ok: true; equityLiabilities: SchSection[]; assets: SchSection[]; totalEL: number; totalAssets: number; balanced: boolean; asOf: string } | { error: string };

// Map each Tally group to a Schedule III sub-head. [side, section, head].
const SCHED_MAP: Record<string, [ 'EL' | 'A', string, string ]> = {
  'Capital Account': ['EL', "Shareholders' funds", 'Share capital'],
  'Reserves & Surplus': ['EL', "Shareholders' funds", 'Reserves & surplus'],
  'Secured Loans': ['EL', 'Non-current liabilities', 'Long-term borrowings'],
  'Unsecured Loans': ['EL', 'Non-current liabilities', 'Long-term borrowings'],
  'Loans (Liability)': ['EL', 'Non-current liabilities', 'Long-term borrowings'],
  'Provisions': ['EL', 'Current liabilities', 'Short-term provisions'],
  'Sundry Creditors': ['EL', 'Current liabilities', 'Trade payables'],
  'Duties & Taxes': ['EL', 'Current liabilities', 'Other current liabilities'],
  'Current Liabilities': ['EL', 'Current liabilities', 'Other current liabilities'],
  'Suspense A/c': ['EL', 'Current liabilities', 'Other current liabilities'],
  'Bank OD A/c': ['EL', 'Current liabilities', 'Short-term borrowings'],
  'Fixed Assets': ['A', 'Non-current assets', 'Fixed assets'],
  'Investments': ['A', 'Non-current assets', 'Non-current investments'],
  'Loans & Advances (Asset)': ['A', 'Non-current assets', 'Long-term loans & advances'],
  'Deposits (Asset)': ['A', 'Non-current assets', 'Long-term loans & advances'],
  'Stock-in-Hand': ['A', 'Current assets', 'Inventories'],
  'Sundry Debtors': ['A', 'Current assets', 'Trade receivables'],
  'Cash-in-Hand': ['A', 'Current assets', 'Cash & cash equivalents'],
  'Bank Accounts': ['A', 'Current assets', 'Cash & cash equivalents'],
  'Current Assets': ['A', 'Current assets', 'Other current assets'],
};
const EL_ORDER = ["Shareholders' funds", 'Non-current liabilities', 'Current liabilities'];
const A_ORDER = ['Non-current assets', 'Current assets'];

/** Balance sheet recast into the Companies Act Schedule III (Division I) format. */
export async function tallyScheduleIII(fromISO: string | null, toISO: string | null, label?: string): Promise<ScheduleIII> {
  try {
    await ensure('finance.ledger.view');
    const data = await getTallyData({ from: fromISO ? new Date(fromISO) : null, to: toISO ? new Date(toISO) : null, label });
    const r2 = (x: number) => Math.round(x * 100) / 100;
    // Aggregate ledger balances into heads, signed for their nature.
    const heads = new Map<string, { side: 'EL' | 'A'; section: string; amount: number }>();
    const add = (side: 'EL' | 'A', section: string, head: string, amt: number) => {
      const key = `${side}|${section}|${head}`;
      const e = heads.get(key) ?? { side, section, amount: 0 };
      e.amount += amt; heads.set(key, e);
    };
    for (const l of data.ledgers) {
      const m = SCHED_MAP[l.group];
      if (!m) continue;
      // Assets carry a Dr balance, liabilities a Cr balance — take the natural side.
      const amt = l.nature === 'ASSET' ? (l.side === 'Dr' ? l.balance : -l.balance) : (l.side === 'Cr' ? l.balance : -l.balance);
      add(m[0], m[1], m[2], amt);
    }
    // Current-period profit sits in Reserves & surplus.
    add('EL', "Shareholders' funds", 'Reserves & surplus', data.pl.profit);

    const build = (side: 'EL' | 'A', order: string[]): SchSection[] => order.map((section) => {
      const hs = [...heads.entries()].filter(([, v]) => v.side === side && v.section === section)
        .map(([k, v]) => ({ label: k.split('|')[2]!, amount: r2(v.amount) }))
        .filter((h) => h.amount !== 0)
        .sort((a, b) => b.amount - a.amount);
      return { title: section, heads: hs, total: r2(hs.reduce((s, h) => s + h.amount, 0)) };
    }).filter((s) => s.heads.length > 0);

    const equityLiabilities = build('EL', EL_ORDER);
    const assets = build('A', A_ORDER);
    const totalEL = r2(equityLiabilities.reduce((s, x) => s + x.total, 0));
    const totalAssets = r2(assets.reduce((s, x) => s + x.total, 0));
    const asOf = data.period.label && data.period.label !== 'All time' ? data.period.label : `As at ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`;
    return { ok: true, equityLiabilities, assets, totalEL, totalAssets, balanced: Math.round(totalEL * 100) === Math.round(totalAssets * 100), asOf };
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

// ── Bank reconciliation ─────────────────────────────────────────────────────
export interface BankReconLine {
  lineId: string; date: string; type: string; number: number; particulars: string;
  debit: number; credit: number; clearedDate: string | null;
}
export type BankRecon = {
  ok: true; name: string; group: string;
  rows: BankReconLine[];
  bookBalance: number; bookSide: 'Dr' | 'Cr';
  bankBalance: number; bankSide: 'Dr' | 'Cr';
  unclearedDebit: number; unclearedCredit: number;
} | { error: string };

/** Bank reconciliation for one bank ledger — book vs bank (cleared-only) balance. */
export async function tallyBankRecon(ledgerId: string): Promise<BankRecon> {
  try {
    await ensure('finance.ledger.view');
    const ledger = await prisma.tallyLedger.findUnique({ where: { id: ledgerId } });
    if (!ledger) return { error: 'Ledger not found.' };
    const lines = await prisma.tallyVoucherLine.findMany({
      where: { ledgerId },
      include: { voucher: { select: { date: true, type: true, number: true, lines: { include: { ledger: { select: { name: true } } } } } } },
      orderBy: [{ voucher: { date: 'asc' } }, { voucher: { number: 'asc' } }],
      take: 5000,
    });
    const opening = ledger.openingSide === 'Dr' ? Number(ledger.openingBalance) : -Number(ledger.openingBalance);
    let book = opening, bank = opening, unclearedDr = 0, unclearedCr = 0;
    const rows: BankReconLine[] = lines.map((ln) => {
      const debit = Number(ln.debit), credit = Number(ln.credit);
      book = Math.round((book + debit - credit) * 100) / 100;
      if (ln.clearedDate) bank = Math.round((bank + debit - credit) * 100) / 100;
      else { unclearedDr += debit; unclearedCr += credit; }
      const particulars = ln.voucher.lines.filter((x) => x.ledger.name !== ledger.name).map((x) => x.ledger.name).join(', ') || ledger.name;
      return { lineId: ln.id, date: ln.voucher.date.toISOString(), type: ln.voucher.type, number: ln.voucher.number, particulars, debit, credit, clearedDate: ln.clearedDate ? ln.clearedDate.toISOString() : null };
    });
    const r2 = (x: number) => Math.round(x * 100) / 100;
    return {
      ok: true, name: ledger.name, group: ledger.group, rows,
      bookBalance: Math.abs(book), bookSide: book >= 0 ? 'Dr' : 'Cr',
      bankBalance: Math.abs(bank), bankSide: bank >= 0 ? 'Dr' : 'Cr',
      unclearedDebit: r2(unclearedDr), unclearedCredit: r2(unclearedCr),
    };
  } catch (e) { const r = toActionError(e); return r; }
}

/** Mark a bank entry cleared on a given date, or un-clear it (null). */
export async function tallySetCleared(lineId: string, dateISO: string | null): Promise<TallyResult> {
  try {
    const ctx = await ensure('finance.ledger.view');
    const line = await prisma.tallyVoucherLine.findUnique({ where: { id: lineId }, select: { id: true, ledgerId: true } });
    if (!line) return { error: 'Entry not found.' };
    await prisma.tallyVoucherLine.update({ where: { id: lineId }, data: { clearedDate: dateISO ? new Date(dateISO) : null } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'TallyVoucherLine', entityId: lineId, summary: dateISO ? `Bank recon: cleared ${dateISO.slice(0, 10)}` : 'Bank recon: un-cleared' });
    revalidatePath('/tally');
    return { ok: true };
  } catch (e) { return toActionError(e); }
}

// ── Personalised tax invoice (PDF) ──────────────────────────────────────────
/** Build a branded tax-invoice PDF for a Sales or Purchase item voucher. */
export async function tallyInvoicePdf(voucherId: string): Promise<{ ok: true; filename: string; pdfBase64: string } | { error: string }> {
  try {
    await ensure('finance.ledger.view');
    const v = await prisma.tallyVoucher.findUnique({
      where: { id: voucherId },
      include: {
        inventoryLines: { include: { item: { select: { name: true, hsn: true, unit: true, gstRate: true } } } },
        lines: { include: { ledger: { select: { name: true, group: true } } } },
      },
    });
    if (!v) return { error: 'Voucher not found.' };
    if (v.type !== 'Sales' && v.type !== 'Purchase') return { error: 'Only Sales and Purchase invoices can be printed as an invoice.' };
    if (v.inventoryLines.length === 0) return { error: 'This voucher has no stock/item lines to invoice.' };

    const partyGroup = v.type === 'Sales' ? 'Sundry Debtors' : 'Sundry Creditors';
    const partyName = v.lines.find((l) => l.ledger.group === partyGroup)?.ledger.name ?? '(party)';
    const r2 = (x: number) => Math.round(x * 100) / 100;
    const items = v.inventoryLines.map((il) => ({
      name: il.item.name, hsn: il.item.hsn, qty: Number(il.qty), unit: il.item.unit,
      rate: Number(il.rate), amount: Number(il.amount), gstRate: Number(il.item.gstRate),
    }));
    const taxable = r2(items.reduce((s, i) => s + i.amount, 0));
    const gst = r2(items.reduce((s, i) => s + (i.amount * i.gstRate) / 100, 0));
    const cgst = r2(gst / 2); const sgst = r2(gst - cgst); const total = r2(taxable + gst);

    const company = await getCompanyDetails();
    const bytes = await buildTallyInvoicePdf({
      company: { name: company.legalName, registeredAddress: company.registeredAddress, phone: company.phone, email: company.email, website: company.website, gstin: company.gstin },
      type: v.type, number: v.number, date: v.date, partyName, items, taxable, cgst, sgst, total, narration: v.narration,
    });
    return { ok: true, filename: `${v.type}-Invoice-${v.number}.pdf`, pdfBase64: Buffer.from(bytes).toString('base64') };
  } catch (e) { return toActionError(e); }
}

// ── Voucher editing ─────────────────────────────────────────────────────────
export interface VoucherEdit {
  ok: true; id: string; type: string; date: string; narration: string | null;
  costCentre: string | null; isInvoice: boolean;
  lines: Array<{ ledgerId: string; debit: number; credit: number }>;
}
/** Fetch one voucher for editing (with ledger IDs so the form can pre-fill). */
export async function tallyVoucherForEdit(id: string): Promise<VoucherEdit | { error: string }> {
  try {
    await ensure('finance.ledger.view');
    const v = await prisma.tallyVoucher.findUnique({ where: { id }, include: { lines: true } });
    if (!v) return { error: 'Voucher not found.' };
    return {
      ok: true, id: v.id, type: v.type, date: v.date.toISOString().slice(0, 10),
      narration: v.narration, costCentre: v.costCentre, isInvoice: v.type === 'Sales' || v.type === 'Purchase',
      lines: v.lines.map((l) => ({ ledgerId: l.ledgerId, debit: Number(l.debit), credit: Number(l.credit) })),
    };
  } catch (e) { const r = toActionError(e); return r; }
}

const voucherEditSchema = z.object({
  id: z.string().min(1),
  date: z.string().min(1),
  narration: z.string().max(500).optional(),
  costCentre: z.string().max(120).optional(),
  lines: z.array(z.object({ ledgerId: z.string().min(1), debit: z.coerce.number().min(0).default(0), credit: z.coerce.number().min(0).default(0) })).min(2, 'A voucher needs at least two lines'),
});

/** Edit an accounting voucher (Contra/Payment/Receipt/Journal) — replaces its lines. */
export async function updateTallyVoucher(input: unknown): Promise<TallyResult> {
  try {
    const ctx = await ensure('finance.ledger.view');
    const d = voucherEditSchema.parse(input);
    const existing = await prisma.tallyVoucher.findUnique({ where: { id: d.id }, select: { type: true, number: true } });
    if (!existing) return { error: 'Voucher not found.' };
    if (existing.type === 'Sales' || existing.type === 'Purchase') return { error: 'Item invoices carry stock — edit the date/narration only, or delete and re-post to change amounts.' };
    const lines = d.lines.filter((l) => l.ledgerId && (l.debit > 0 || l.credit > 0));
    if (lines.length < 2) return { error: 'Enter at least two ledger lines with amounts.' };
    const totalDr = Math.round(lines.reduce((s, l) => s + l.debit, 0) * 100);
    const totalCr = Math.round(lines.reduce((s, l) => s + l.credit, 0) * 100);
    if (totalDr === 0) return { error: 'The voucher amount cannot be zero.' };
    if (totalDr !== totalCr) return { error: `Debit and credit must match. Dr ₹${(totalDr / 100).toLocaleString('en-IN')} vs Cr ₹${(totalCr / 100).toLocaleString('en-IN')}.` };

    await prisma.$transaction([
      prisma.tallyVoucherLine.deleteMany({ where: { voucherId: d.id } }),
      prisma.tallyVoucher.update({
        where: { id: d.id },
        data: {
          date: new Date(d.date), narration: d.narration || null, costCentre: d.costCentre?.trim() || null,
          lines: { create: lines.map((l) => ({ ledgerId: l.ledgerId, debit: l.debit, credit: l.credit })) },
        },
      }),
    ]);
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'TallyVoucher', entityId: d.id, summary: `Edited Tally ${existing.type} #${existing.number} — Rs ${(totalDr / 100).toLocaleString('en-IN')}` });
    revalidatePath('/tally');
    return { ok: true, id: d.id };
  } catch (e) { return toActionError(e); }
}

const headerEditSchema = z.object({
  id: z.string().min(1),
  date: z.string().min(1),
  narration: z.string().max(500).optional(),
  costCentre: z.string().max(120).optional(),
});
/** Edit just the header of any voucher (date, narration, cost centre) — safe for invoices. */
export async function updateTallyVoucherHeader(input: unknown): Promise<TallyResult> {
  try {
    const ctx = await ensure('finance.ledger.view');
    const d = headerEditSchema.parse(input);
    const existing = await prisma.tallyVoucher.findUnique({ where: { id: d.id }, select: { type: true, number: true } });
    if (!existing) return { error: 'Voucher not found.' };
    await prisma.tallyVoucher.update({ where: { id: d.id }, data: { date: new Date(d.date), narration: d.narration || null, costCentre: d.costCentre?.trim() || null } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'TallyVoucher', entityId: d.id, summary: `Edited header of Tally ${existing.type} #${existing.number}` });
    revalidatePath('/tally');
    return { ok: true, id: d.id };
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
