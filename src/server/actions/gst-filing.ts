'use server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { getCompanyDetails } from '@/server/services/company-service';
import { stateCodeOf, buildGstr1Json, buildEInvoiceJson, buildEwayBillJson, type FilingInvoice, type Seller } from '@/lib/gst/filing-json';
import { ensure, toActionError } from './_helpers';

export type JsonResult = { ok: true; filename: string; json: string } | { error: string };

async function seller(): Promise<Seller> {
  const c = await getCompanyDetails();
  return {
    gstin: c.gstin,
    legalName: c.legalName,
    address: c.registeredAddress,
    stateCode: stateCodeOf(c.gstin) || '29',
  };
}

function toFilingInvoice(inv: {
  number: string; issueDate: Date; clientName: string; clientGstin: string | null;
  subTotal: unknown; cgst: unknown; sgst: unknown; igst: unknown; total: unknown;
  items: Array<{ description: string; hsnSac: string | null; quantity: unknown; rate: unknown; gstRate: unknown; amount: unknown }>;
}): FilingInvoice {
  const n = (x: unknown) => Number(x ?? 0);
  return {
    number: inv.number,
    issueDate: inv.issueDate.toISOString(),
    clientName: inv.clientName,
    clientGstin: inv.clientGstin,
    clientStateCode: stateCodeOf(inv.clientGstin) || null,
    subTotal: n(inv.subTotal), cgst: n(inv.cgst), sgst: n(inv.sgst), igst: n(inv.igst), total: n(inv.total),
    items: inv.items.map((it) => ({
      description: it.description, hsnSac: it.hsnSac,
      quantity: n(it.quantity), rate: n(it.rate), gstRate: n(it.gstRate), amount: n(it.amount),
    })),
  };
}

const INVOICE_SELECT = {
  number: true, issueDate: true, clientName: true, clientGstin: true,
  subTotal: true, cgst: true, sgst: true, igst: true, total: true,
  items: { select: { description: true, hsnSac: true, quantity: true, rate: true, gstRate: true, amount: true } },
} as const;

/** GSTR-1 filing JSON for a month, from all non-draft invoices issued that month. */
export async function gstr1JsonForPeriod(month: number, year: number): Promise<JsonResult> {
  try {
    await ensure('finance.ledger.view');
    const { month: m, year: y } = z.object({ month: z.coerce.number().int().min(1).max(12), year: z.coerce.number().int().min(2018).max(2100) }).parse({ month, year });
    const from = new Date(Date.UTC(y, m - 1, 1));
    const to = new Date(Date.UTC(y, m, 1));
    const rows = await prisma.invoice.findMany({
      where: { status: { not: 'DRAFT' }, issueDate: { gte: from, lt: to } },
      select: INVOICE_SELECT,
      take: 5000,
    });
    const s = await seller();
    const json = buildGstr1Json(s, rows.map(toFilingInvoice), { month: m, year: y });
    return { ok: true, filename: `GSTR1-${s.gstin}-${String(m).padStart(2, '0')}${y}.json`, json: JSON.stringify(json, null, 2) };
  } catch (e) { return toActionError(e); }
}

/** E-invoice (IRN) JSON for one invoice. */
export async function eInvoiceJson(invoiceId: string): Promise<JsonResult> {
  try {
    await ensure('finance.ledger.view');
    const id = z.string().min(1).parse(invoiceId);
    const inv = await prisma.invoice.findUnique({ where: { id }, select: INVOICE_SELECT });
    if (!inv) return { error: 'Invoice not found.' };
    const s = await seller();
    const json = buildEInvoiceJson(s, toFilingInvoice(inv));
    return { ok: true, filename: `EINV-${inv.number}.json`, json: JSON.stringify(json, null, 2) };
  } catch (e) { return toActionError(e); }
}

/** E-way-bill JSON for one invoice. */
export async function ewayBillJson(invoiceId: string): Promise<JsonResult> {
  try {
    await ensure('finance.ledger.view');
    const id = z.string().min(1).parse(invoiceId);
    const inv = await prisma.invoice.findUnique({ where: { id }, select: INVOICE_SELECT });
    if (!inv) return { error: 'Invoice not found.' };
    const s = await seller();
    const json = buildEwayBillJson(s, toFilingInvoice(inv));
    return { ok: true, filename: `EWB-${inv.number}.json`, json: JSON.stringify(json, null, 2) };
  } catch (e) { return toActionError(e); }
}

/** Recent non-draft invoices, for the per-invoice e-invoice / e-way-bill pickers. */
export async function recentInvoicesForFiling(): Promise<{ ok: true; rows: Array<{ id: string; number: string; clientName: string; total: number; issued: string }> } | { error: string }> {
  try {
    await ensure('finance.ledger.view');
    const rows = await prisma.invoice.findMany({
      where: { status: { not: 'DRAFT' } },
      orderBy: { issueDate: 'desc' },
      take: 100,
      select: { id: true, number: true, clientName: true, total: true, issueDate: true },
    });
    return { ok: true, rows: rows.map((r) => ({ id: r.id, number: r.number, clientName: r.clientName, total: Number(r.total), issued: r.issueDate.toISOString() })) };
  } catch (e) { return toActionError(e); }
}
