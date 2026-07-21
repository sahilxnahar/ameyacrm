'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { docNumber } from '@/lib/utils/reference';
import { writeAudit } from '@/lib/audit/log';
import { notifyMany } from '@/lib/notifications/notify';
import { ensure, toActionError } from './_helpers';
import { isGeminiEnabled, extractInvoiceData, type ExtractedBill } from '@/lib/ai/gemini';

export type BillingResult = { ok: true; id: string } | { error: string };

const lineSchema = z.object({
  description: z.string().min(1),
  hsnSac: z.string().optional(),
  quantity: z.coerce.number().positive().default(1),
  rate: z.coerce.number().nonnegative().default(0),
  gstRate: z.coerce.number().min(0).max(28).default(18),
});
const invoiceSchema = z.object({
  clientName: z.string().min(2),
  clientGstin: z.string().optional(),
  issueDate: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  notes: z.string().optional(),
  intraState: z.boolean().default(true),
  items: z.array(lineSchema).min(1, 'Add at least one line item'),
});

export async function createInvoice(input: unknown): Promise<BillingResult> {
  try {
    const ctx = await ensure('billing.invoice.manage');
    const d = invoiceSchema.parse(input);

    let subTotal = 0, taxTotal = 0;
    const items = d.items.map((i) => {
      const amount = i.quantity * i.rate;
      const tax = (amount * i.gstRate) / 100;
      subTotal += amount; taxTotal += tax;
      return { description: i.description, hsnSac: i.hsnSac || null, quantity: i.quantity, rate: i.rate, gstRate: i.gstRate, amount };
    });
    const total = subTotal + taxTotal;
    const seq = (await prisma.invoice.count()) + 1;

    const invoice = await prisma.invoice.create({
      data: {
        number: docNumber('INV', seq), clientName: d.clientName, clientGstin: d.clientGstin || null,
        projectId: d.projectId || null, dueDate: d.dueDate ? new Date(d.dueDate) : null, notes: d.notes || null,
        status: 'DRAFT', subTotal, total, issueDate: d.issueDate ? new Date(d.issueDate) : undefined,
        cgst: d.intraState ? taxTotal / 2 : 0, sgst: d.intraState ? taxTotal / 2 : 0, igst: d.intraState ? 0 : taxTotal,
        createdById: ctx.user.id, items: { create: items },
      },
    });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'Invoice', entityId: invoice.id, summary: `Created invoice ${invoice.number}` });
    revalidatePath('/billing');
    return { ok: true, id: invoice.id };
  } catch (err) {
    return toActionError(err);
  }
}

// ─── Vendors, Purchase Orders, Vendor Bills, PO approvals (Billing depth) ────

export async function createVendor(input: unknown): Promise<BillingResult> {
  try {
    const ctx = await ensure('billing.po.manage');
    const d = z.object({
      id: z.string().optional().or(z.literal('')),
      name: z.string().min(2),
      gstin: z.string().max(20).optional().or(z.literal('')),
      pan: z.string().max(12).optional().or(z.literal('')),
      email: z.string().email().optional().or(z.literal('')),
      phone: z.string().max(20).optional().or(z.literal('')),
      address: z.string().max(400).optional().or(z.literal('')),
      bankAccountName: z.string().max(160).optional().or(z.literal('')),
      bankAccountNumber: z.string().max(30).optional().or(z.literal('')),
      bankIfsc: z.string().max(15).optional().or(z.literal('')),
      bankName: z.string().max(80).optional().or(z.literal('')),
      bankBranch: z.string().max(120).optional().or(z.literal('')),
      upiId: z.string().max(80).optional().or(z.literal('')),
      paymentNotes: z.string().max(400).optional().or(z.literal('')),
    }).parse(input);

    // An IFSC is always 11 characters: four letters, a zero, then six more.
    // Catching it here saves a failed transfer and a day of chasing.
    const ifsc = (d.bankIfsc || '').toUpperCase().replace(/\s/g, '');
    if (ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
      return { error: `"${ifsc}" is not a valid IFSC. It should be 11 characters — four letters, then a zero, then six more.` };
    }
    const account = (d.bankAccountNumber || '').replace(/\s/g, '');
    if (account && !/^[0-9]{6,20}$/.test(account)) {
      return { error: 'A bank account number should be 6 to 20 digits, with no letters or spaces.' };
    }
    if (d.upiId && !/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(d.upiId)) {
      return { error: 'That UPI ID does not look right — it should read like name@bank.' };
    }

    const data = {
      name: d.name, gstin: d.gstin || null, pan: d.pan ? d.pan.toUpperCase() : null,
      email: d.email || null, phone: d.phone || null, address: d.address || null,
      bankAccountName: d.bankAccountName || null, bankAccountNumber: account || null,
      bankIfsc: ifsc || null, bankName: d.bankName || null, bankBranch: d.bankBranch || null,
      upiId: d.upiId || null, paymentNotes: d.paymentNotes || null,
    };
    const v = d.id
      ? await prisma.vendor.update({ where: { id: d.id }, data })
      : await prisma.vendor.create({ data });
    await writeAudit({ actorId: ctx.user.id, action: d.id ? 'UPDATE' : 'CREATE', entityType: 'Vendor', entityId: v.id, summary: `${d.id ? 'Updated' : 'Added'} vendor ${d.name}` });
    revalidatePath('/billing');
    return { ok: true, id: v.id };
  } catch (err) { return toActionError(err); }
}

const poSchema = z.object({
  vendorId: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  expectedAt: z.string().optional().nullable(),
  notes: z.string().optional(),
  approverIds: z.array(z.string()).default([]),
  items: z.array(z.object({
    description: z.string().min(1), hsnSac: z.string().optional(), unit: z.string().default('nos'),
    quantity: z.coerce.number().positive().default(1), rate: z.coerce.number().nonnegative().default(0), gstRate: z.coerce.number().min(0).max(28).default(18),
  })).min(1, 'Add at least one line item'),
});

export async function createPurchaseOrder(input: unknown): Promise<BillingResult> {
  try {
    const ctx = await ensure('billing.po.manage');
    const d = poSchema.parse(input);
    let subTotal = 0, taxTotal = 0;
    const items = d.items.map((i) => {
      const amount = i.quantity * i.rate; const tax = (amount * i.gstRate) / 100;
      subTotal += amount; taxTotal += tax;
      return { description: i.description, hsnSac: i.hsnSac || null, unit: i.unit, quantity: i.quantity, rate: i.rate, gstRate: i.gstRate, amount };
    });
    const seq = (await prisma.purchaseOrder.count()) + 1;
    const po = await prisma.purchaseOrder.create({
      data: {
        number: docNumber('PO', seq), vendorId: d.vendorId || null, projectId: d.projectId || null,
        status: d.approverIds.length ? 'PENDING_APPROVAL' : 'DRAFT',
        expectedAt: d.expectedAt ? new Date(d.expectedAt) : null, notes: d.notes || null,
        subTotal, taxTotal, total: subTotal + taxTotal, createdById: ctx.user.id, items: { create: items },
      },
    });
    if (d.approverIds.length) {
      await prisma.approvalRequest.create({
        data: { entityType: 'PURCHASE_ORDER', entityId: po.id, requesterId: ctx.user.id, steps: { create: d.approverIds.map((approverId, i) => ({ approverId, sequence: i + 1 })) } },
      });
      await notifyMany(d.approverIds, { type: 'APPROVAL', title: `Approve PO ${po.number}`, link: '/billing' });
    }
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'PurchaseOrder', entityId: po.id, summary: `Created PO ${po.number}` });
    revalidatePath('/billing');
    return { ok: true, id: po.id };
  } catch (err) { return toActionError(err); }
}

export async function decidePurchaseOrder(poId: string, decision: 'APPROVED' | 'REJECTED', comment?: string): Promise<BillingResult> {
  try {
    const ctx = await ensure('billing.approve');
    const step = await prisma.approvalStep.findFirst({ where: { request: { entityType: 'PURCHASE_ORDER', entityId: poId }, approverId: ctx.user.id, status: 'PENDING' }, include: { request: true } });
    if (!step) return { error: 'No pending approval for you on this PO.' };
    await prisma.approvalStep.update({ where: { id: step.id }, data: { status: decision, comment: comment || null, decidedAt: new Date() } });
    const remaining = await prisma.approvalStep.count({ where: { requestId: step.requestId, status: 'PENDING' } });
    const finalStatus = decision === 'REJECTED' ? 'REJECTED' : remaining === 0 ? 'APPROVED' : 'PENDING';
    if (finalStatus !== 'PENDING') {
      await prisma.approvalRequest.update({ where: { id: step.requestId }, data: { status: finalStatus } });
      await prisma.purchaseOrder.update({ where: { id: poId }, data: { status: finalStatus === 'APPROVED' ? 'APPROVED' : 'CANCELLED' } });
    }
    const po = await prisma.purchaseOrder.findUnique({ where: { id: poId } });
    if (po?.createdById) await notifyMany([po.createdById], { type: 'APPROVAL', title: `PO ${po.number} ${decision.toLowerCase()}`, link: '/billing' });
    await writeAudit({ actorId: ctx.user.id, action: decision === 'APPROVED' ? 'APPROVE' : 'REJECT', entityType: 'PurchaseOrder', entityId: poId });
    revalidatePath('/billing');
    return { ok: true, id: poId };
  } catch (err) { return toActionError(err); }
}

export async function createVendorBill(input: unknown): Promise<BillingResult> {
  try {
    const ctx = await ensure('billing.bill.manage');
    const d = z.object({
      number: z.string().min(1), vendorId: z.string().optional().nullable(),
      amount: z.coerce.number().nonnegative(), gstAmount: z.coerce.number().nonnegative().default(0),
      billDate: z.string().optional().nullable(), dueDate: z.string().optional().nullable(),
    }).parse(input);
    const bill = await prisma.vendorBill.create({
      data: { number: d.number, vendorId: d.vendorId || null, amount: d.amount, gstAmount: d.gstAmount, billDate: d.billDate ? new Date(d.billDate) : new Date(), dueDate: d.dueDate ? new Date(d.dueDate) : null, createdById: ctx.user.id },
    });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'VendorBill', entityId: bill.id, summary: `Recorded bill ${d.number}` });
    revalidatePath('/billing');
    return { ok: true, id: bill.id };
  } catch (err) { return toActionError(err); }
}

/** Upload a bill/invoice file → Gemini extracts structured data for review (does NOT save). */
export async function extractBill(formData: FormData): Promise<{ ok: true; draft: ExtractedBill } | { error: string }> {
  try {
    await ensure('billing.invoice.manage');
    if (!isGeminiEnabled()) return { error: 'Gemini API key is not configured (set GEMINI_API_KEY).' };
    const file = formData.get('file');
    if (!(file instanceof File)) return { error: 'No file provided.' };
    if (file.size > 15 * 1024 * 1024) return { error: 'File exceeds the 15MB limit for AI reading.' };
    const buffer = Buffer.from(await file.arrayBuffer());
    const draft = await extractInvoiceData(buffer, file.type, file.name);
    if (!draft) return { error: 'Could not read billing data from this file.' };
    // The reader now says what went wrong rather than one message for everything.
    if ('error' in draft) return { error: draft.error };
    return { ok: true, draft };
  } catch (err) { return toActionError(err); }
}
