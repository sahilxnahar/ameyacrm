'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { docNumber } from '@/lib/utils/reference';
import { nextSequence } from '@/lib/db/sequence';
import { msmeDueDate } from '@/server/services/msme-service';
import { writeAudit } from '@/lib/audit/log';
import { notifyMany } from '@/lib/notifications/notify';
import { ensure, toActionError } from './_helpers';
import { isGeminiEnabled, extractInvoiceData, type ExtractedBill } from '@/lib/ai/gemini';
import { invoiceLines, vendorBillLines } from '@/lib/ledger/posting-rules';
import { postVoucherById } from '@/lib/ledger/post-voucher';
import { nextVoucherNumber } from '@/lib/db/voucher-number';
import { needsPaymentApproval, notifyPaymentApprovers } from '@/server/services/payment-approval-service';
import { post } from '@/server/services/ledger-service';

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
    // count()+1 gave two simultaneous invoices the same number, and reissued a
    // number the moment one was deleted. An invoice number that repeats is a GST
    // problem, not a cosmetic one.
    const seq = await nextSequence('invoice:INV', prisma, 0);

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

/**
 * Pay a vendor bill.
 *
 * The bill already booked the cost and the payable when it was received; this
 * clears the payable and moves the money. Recording the payment as a plain
 * expense voucher instead — which is what happened before bills and payments
 * were linked — books the same spend twice and leaves a creditor balance that
 * never comes down.
 */
export async function settleVendorBill(input: unknown): Promise<BillingResult> {
  try {
    const ctx = await ensure('billing.bill.manage');
    const d = z.object({
      billId: z.string().min(1),
      mode: z.enum(['CASH', 'BANK_TRANSFER', 'UPI', 'CHEQUE']).default('BANK_TRANSFER'),
      paidOn: z.string().optional().nullable(),
      utr: z.string().max(40).optional().nullable(),
    }).parse(input);

    const bill = await prisma.vendorBill.findUnique({
      where: { id: d.billId },
      select: { id: true, number: true, amount: true, gstAmount: true, status: true, vendorId: true, vendor: { select: { name: true, isActive: true } } },
    });
    if (!bill) return { error: 'That bill no longer exists.' };
    if (bill.status === 'PAID') return { error: `Bill ${bill.number} is already paid.` };
    if (bill.vendor && !bill.vendor.isActive) return { error: 'That vendor is deactivated — clear the flag before paying.' };

    const existing = await prisma.voucher.findFirst({ where: { vendorBillId: bill.id, status: { not: 'CANCELLED' } }, select: { number: true } });
    if (existing) return { error: `Bill ${bill.number} already has payment ${existing.number} against it.` };

    const gross = Number(bill.amount) + Number(bill.gstAmount);
    if (gross <= 0) return { error: 'That bill has no amount to pay.' };

    // Paying clears the payable the bill created. If the bill never reached the
    // ledger — posting is non-fatal, so a bill raised before the chart of
    // accounts existed did not — clearing it would debit a creditor nobody ever
    // credited, and the cost would never be booked at all. Post the bill first.
    const billPosted = await prisma.journalEntry.findFirst({
      where: { sourceType: 'VendorBill', sourceId: bill.id, status: { not: 'REVERSED' } }, select: { id: true },
    });
    if (!billPosted) {
      const rule = vendorBillLines({
        amount: gross, gstAmount: Number(bill.gstAmount),
        vendorId: bill.vendorId, vendorName: bill.vendor?.name ?? 'vendor',
      });
      if ('ok' in rule) {
        await post({
          entryDate: new Date(), narration: `${bill.number} — ${rule.narration}`, lines: rule.lines,
          sourceType: 'VendorBill', sourceId: bill.id, createdById: ctx.user.id, once: true,
        }).catch(() => undefined);
      }
      const nowPosted = await prisma.journalEntry.findFirst({
        where: { sourceType: 'VendorBill', sourceId: bill.id, status: { not: 'REVERSED' } }, select: { id: true },
      });
      if (!nowPosted) return { error: `Bill ${bill.number} is not in the ledger yet and could not be posted — usually the chart of accounts has not been set up. Paying it now would leave the cost unbooked.` };
    }
    const needsApproval = await needsPaymentApproval(gross);
    const when = d.paidOn ? new Date(d.paidOn) : new Date();

    const v = await prisma.voucher.create({
      data: {
        number: await nextVoucherNumber('CP'),
        kind: d.mode === 'CASH' ? 'CASH_PAID' : 'BANK_PAID',
        status: needsApproval ? 'DRAFT' : 'POSTED',
        voucherDate: when, paidOn: d.mode === 'CASH' ? null : when,
        partyName: bill.vendor?.name ?? 'Vendor', vendorId: bill.vendorId,
        amount: gross, mode: d.mode,
        reference: bill.number, vendorBillId: bill.id,
        utr: d.utr ? d.utr.replace(/[^A-Za-z0-9]/g, '').toUpperCase() : null,
        narration: `Settlement of vendor bill ${bill.number}`,
        createdById: ctx.user.id,
      },
      select: { id: true, number: true },
    });

    if (needsApproval) {
      await notifyPaymentApprovers(v.id, ctx.user.id, `${v.number} · ${bill.vendor?.name ?? 'vendor'} · Rs ${gross.toLocaleString('en-IN')}`);
    } else {
      await prisma.vendorBill.update({ where: { id: bill.id }, data: { status: 'PAID' } });
      await postVoucherById(v.id, ctx.user.id);
      // The 45-day s.43B(h) clock stops when the money moves, not when somebody
      // remembers to tick it off.
      const { closeMsmeClockForBill } = await import('@/server/services/msme-service');
      await closeMsmeClockForBill(bill.id, v.id);
    }

    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'Voucher', entityId: v.id, summary: `Bill ${bill.number} settled → ${v.number} (Rs ${gross.toLocaleString('en-IN')})${needsApproval ? ' — awaiting approval' : ''}` });
    revalidatePath('/billing'); revalidatePath('/payments'); revalidatePath('/ledgers');
    return { ok: true, id: v.id };
  } catch (err) { return toActionError(err); }
}

/**
 * Issue a draft invoice — the moment the sale is recognised.
 *
 * Creating an invoice leaves it DRAFT deliberately: a draft is a working
 * document and must not touch the books. Issuing it is what recognises the
 * revenue, raises the receivable and creates the output GST liability, so it is
 * the only correct place to post. Doing it at creation would put unfinished
 * invoices into the P&L; doing it at payment would be cash accounting and would
 * lose the receivable entirely.
 */
export async function issueInvoice(invoiceId: string): Promise<BillingResult> {
  try {
    const ctx = await ensure('billing.invoice.manage');
    const inv = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true, number: true, status: true, total: true, cgst: true, sgst: true, igst: true,
        clientName: true, projectId: true, issueDate: true,
      },
    });
    if (!inv) return { error: 'That invoice no longer exists.' };

    // An invoice can be SENT and still not in the books — posting is deliberately
    // non-fatal, so the first invoice raised before the chart of accounts exists
    // ends up exactly there. Refusing to re-issue it would strand the revenue
    // with no way back, so a SENT-but-unposted invoice is repaired instead.
    const alreadyPosted = await prisma.journalEntry.findFirst({
      where: { sourceType: 'Invoice', sourceId: inv.id, status: { not: 'REVERSED' } }, select: { id: true },
    });
    if (inv.status !== 'DRAFT' && alreadyPosted) return { error: `Invoice ${inv.number} is already ${inv.status.toLowerCase()} and in the ledger.` };
    if (inv.status === 'VOID') return { error: `Invoice ${inv.number} is void.` };

    // Status first: the invoice being issued is the fact, the ledger entry is a
    // consequence. A books problem must not stop the invoice going out.
    await prisma.invoice.update({ where: { id: invoiceId }, data: { status: 'SENT' } });

    const rule = invoiceLines({
      total: Number(inv.total), cgst: Number(inv.cgst ?? 0), sgst: Number(inv.sgst ?? 0), igst: Number(inv.igst ?? 0),
      projectId: inv.projectId, clientName: inv.clientName,
    });
    if ('ok' in rule) {
      const r = await post({
        entryDate: inv.issueDate ?? new Date(), narration: `${inv.number} — ${rule.narration}`,
        lines: rule.lines, sourceType: 'Invoice', sourceId: inv.id,
        projectId: inv.projectId, createdById: ctx.user.id, once: true,
      }).catch(() => ({ error: 'posting error' }) as const);
      if ('error' in r) {
        await writeAudit({
          actorId: ctx.user.id, action: 'UPDATE', entityType: 'Invoice', entityId: inv.id,
          summary: `Invoice ${inv.number} issued but NOT posted to the ledger: ${r.error}`,
        }).catch(() => undefined);
      }
    }

    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'Invoice', entityId: inv.id, summary: `Issued invoice ${inv.number}` });
    revalidatePath('/billing'); revalidatePath('/ledgers');
    return { ok: true, id: inv.id };
  } catch (err) { return toActionError(err); }
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
    // count()+1 reissues a number as soon as one PO is deleted, and gives two
    // simultaneous POs the same one. `PurchaseOrder.number` is unique, so that
    // is a failed save, not a cosmetic problem.
    const seq = await nextSequence('po:PO', prisma, 0);
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
      attachmentUrl: z.string().optional().nullable(),
      attachmentName: z.string().optional().nullable(),
      notes: z.string().max(1000).optional().nullable(),
    }).parse(input);
    const bill = await prisma.vendorBill.create({
      data: { number: d.number, vendorId: d.vendorId || null, amount: d.amount, gstAmount: d.gstAmount, billDate: d.billDate ? new Date(d.billDate) : new Date(), dueDate: d.dueDate ? new Date(d.dueDate) : null, createdById: ctx.user.id,
        attachmentUrl: d.attachmentUrl?.trim() || null, attachmentName: d.attachmentName?.trim() || null, notes: d.notes?.trim() || null },
    });
    // A bill received IS a cost and a liability, on the day it is received —
    // not on the day it is paid. Booking it only at payment is cash accounting,
    // which understates cost at every month end and hides what is owed.
    // Non-fatal: an unpostable bill is still a bill.
    const billVendorName = d.vendorId
      ? (await prisma.vendor.findUnique({ where: { id: d.vendorId }, select: { name: true } }).catch(() => null))?.name ?? 'vendor'
      : 'vendor';
    const billRule = vendorBillLines({
      amount: d.amount + d.gstAmount, gstAmount: d.gstAmount,
      vendorId: d.vendorId || null, vendorName: billVendorName,
    });
    if ('ok' in billRule) {
      const r = await post({
        entryDate: bill.billDate, narration: `${bill.number} — ${billRule.narration}`,
        lines: billRule.lines, sourceType: 'VendorBill', sourceId: bill.id,
        createdById: ctx.user.id, once: true,
      }).catch(() => ({ error: 'posting error' }) as const);
      if ('error' in r) {
        await writeAudit({
          actorId: ctx.user.id, action: 'UPDATE', entityType: 'VendorBill', entityId: bill.id,
          summary: `Bill ${bill.number} saved but NOT posted to the ledger: ${r.error}`,
        }).catch(() => undefined);
      }
    }

    // Start the MSME clock with the bill, not by hand.
    //
    // Section 15 of the MSMED Act gives 45 days (15 without a written
    // agreement), and s.43B(h) of the Income-tax Act disallows the expense
    // entirely if you miss it. That is real tax money, and it turned on
    // somebody remembering to open the tracker and type the bill in a second
    // time. If the vendor is registered as MSME, the clock now starts itself.
    if (d.vendorId) {
      const vendor = await prisma.vendor.findUnique({
        where: { id: d.vendorId },
        select: { isMsme: true, udyamNumber: true, msmeHasAgreement: true },
      }).catch(() => null);

      if (vendor?.isMsme) {
        const billDate = d.billDate ? new Date(d.billDate) : new Date();
        await prisma.msmePaymentClock.create({
          data: {
            vendorId: d.vendorId,
            vendorBillId: bill.id,
            udyamNo: vendor.udyamNumber ?? null,
            billDate,
            dueDate: msmeDueDate(billDate, vendor.msmeHasAgreement),
            amount: d.amount + d.gstAmount,
          },
        }).catch(() => undefined);   // a clock that cannot start must not lose the bill
      }
    }

    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'VendorBill', entityId: bill.id, summary: `Recorded bill ${d.number}` });
    revalidatePath('/billing');
    revalidatePath('/msme-tracker');
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

/**
 * Record a bill you RECEIVED, resolving the supplier by name.
 *
 * The AI importer had a button labelled "Import bill" that called
 * `createInvoice` — so scanning a supplier's bill booked it as one of YOUR
 * sales invoices: money owed to you rather than by you, in the wrong direction
 * on the balance sheet and in your GSTR-1. This is what that button should
 * always have done.
 *
 * The supplier is matched by name and created if new, because a bill arrives
 * with a name on it, not with an id from your vendor master.
 */
export async function createVendorBillFromImport(input: unknown): Promise<BillingResult> {
  try {
    const ctx = await ensure('billing.bill.manage');
    const d = z.object({
      vendorName: z.string().min(2, 'Whose bill is it?').max(160),
      number: z.string().min(1, 'A bill needs its number.').max(60),
      amount: z.coerce.number().nonnegative(),
      gstAmount: z.coerce.number().nonnegative().default(0),
      billDate: z.string().optional().nullable(),
      dueDate: z.string().optional().nullable(),
      notes: z.string().max(500).optional().nullable(),
    }).parse(input);

    if (d.amount + d.gstAmount <= 0) return { error: 'The bill has no amount on it.' };

    const name = d.vendorName.trim();
    const existing = await prisma.vendor.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
      select: { id: true },
    });
    const vendorId = existing?.id
      ?? (await prisma.vendor.create({ data: { name }, select: { id: true } })).id;

    // Same supplier, same bill number is the same bill — an importer that runs
    // twice must not double the payable.
    const dupe = await prisma.vendorBill.findFirst({
      where: { vendorId, number: d.number.trim() },
      select: { id: true, number: true },
    });
    if (dupe) return { error: `Bill ${dupe.number} from ${name} is already recorded.` };

    return await createVendorBill({
      number: d.number.trim(),
      vendorId,
      amount: d.amount,
      gstAmount: d.gstAmount,
      billDate: d.billDate || null,
      dueDate: d.dueDate || null,
    });
  } catch (err) {
    return toActionError(err);
  }
}

/**
 * Correct a bill.
 *
 * There was no way to. A bill entered with the wrong amount was permanent —
 * and because a bill now posts to the ledger the moment it is recorded, the
 * wrong number was in the books too. Editing re-posts, so the books follow the
 * correction instead of keeping the mistake.
 */
export async function updateVendorBill(input: unknown): Promise<BillingResult> {
  try {
    const ctx = await ensure('billing.bill.manage');
    const d = z.object({
      billId: z.string().min(1),
      number: z.string().min(1).max(60),
      vendorId: z.string().optional().nullable(),
      amount: z.coerce.number().nonnegative(),
      gstAmount: z.coerce.number().nonnegative().default(0),
      billDate: z.string().optional().nullable(),
      dueDate: z.string().optional().nullable(),
      attachmentUrl: z.string().optional().nullable(),
      attachmentName: z.string().optional().nullable(),
      notes: z.string().max(1000).optional().nullable(),
    }).parse(input);

    const bill = await prisma.vendorBill.findUnique({
      where: { id: d.billId },
      select: { id: true, number: true, status: true },
    });
    if (!bill) return { error: 'That bill no longer exists.' };
    if (bill.status === 'PAID') return { error: `Bill ${bill.number} has been paid. Withdraw the payment first, then correct it.` };

    const settled = await prisma.voucher.findFirst({ where: { vendorBillId: bill.id, status: { not: 'CANCELLED' } }, select: { number: true } });
    if (settled) return { error: `Payment ${settled.number} is already raised against this bill. Withdraw it first.` };

    await prisma.vendorBill.update({
      where: { id: d.billId },
      data: {
        number: d.number.trim(), vendorId: d.vendorId || null,
        amount: d.amount, gstAmount: d.gstAmount,
        billDate: d.billDate ? new Date(d.billDate) : undefined,
        dueDate: d.dueDate ? new Date(d.dueDate) : null,
        attachmentUrl: d.attachmentUrl?.trim() || null,
        attachmentName: d.attachmentName?.trim() || null,
        notes: d.notes?.trim() || null,
      },
    });

    // The books have to follow the correction. Reverse what the old figure
    // posted, then post the new one — never edit a journal entry in place.
    const entry = await prisma.journalEntry.findFirst({
      where: { sourceType: 'VendorBill', sourceId: bill.id, status: 'POSTED' },
      select: { id: true },
    });
    if (entry) {
      const { reverse } = await import('@/server/services/ledger-service');
      await reverse(entry.id, `Bill ${bill.number} corrected`, ctx.user.id).catch(() => undefined);
    }
    const vendorName = d.vendorId
      ? (await prisma.vendor.findUnique({ where: { id: d.vendorId }, select: { name: true } }).catch(() => null))?.name ?? 'vendor'
      : 'vendor';
    const rule = vendorBillLines({
      amount: d.amount + d.gstAmount, gstAmount: d.gstAmount,
      vendorId: d.vendorId || null, vendorName,
    });
    if ('ok' in rule) {
      await post({
        entryDate: d.billDate ? new Date(d.billDate) : new Date(),
        narration: `${d.number.trim()} — ${rule.narration} (corrected)`,
        lines: rule.lines, sourceType: 'VendorBill', sourceId: bill.id,
        createdById: ctx.user.id,
      }).catch(() => undefined);
    }

    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'VendorBill', entityId: bill.id, summary: `Corrected bill ${bill.number} → ${d.number.trim()} (Rs ${(d.amount + d.gstAmount).toLocaleString('en-IN')})` });
    revalidatePath('/billing'); revalidatePath('/ledgers');
    return { ok: true, id: bill.id };
  } catch (err) { return toActionError(err); }
}

/** Void a bill that should never have been recorded. The row stays, marked VOID. */
export async function voidVendorBill(billId: string, reason: string): Promise<BillingResult> {
  try {
    const ctx = await ensure('billing.bill.manage');
    const why = (reason ?? '').trim();
    if (why.length < 3) return { error: 'Say why it is being voided.' };

    const bill = await prisma.vendorBill.findUnique({ where: { id: billId }, select: { id: true, number: true, status: true } });
    if (!bill) return { error: 'That bill no longer exists.' };
    if (bill.status === 'PAID') return { error: `Bill ${bill.number} has been paid. Withdraw the payment first.` };

    await prisma.vendorBill.update({ where: { id: billId }, data: { status: 'VOID' } });

    // A voided bill must not leave a payable standing in the books.
    const entry = await prisma.journalEntry.findFirst({
      where: { sourceType: 'VendorBill', sourceId: billId, status: 'POSTED' }, select: { id: true },
    });
    if (entry) {
      const { reverse } = await import('@/server/services/ledger-service');
      await reverse(entry.id, `Bill ${bill.number} voided — ${why.slice(0, 120)}`, ctx.user.id).catch(() => undefined);
    }
    await prisma.msmePaymentClock.deleteMany({ where: { vendorBillId: billId } }).catch(() => undefined);

    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'VendorBill', entityId: billId, summary: `Voided bill ${bill.number} — ${why.slice(0, 200)}` });
    revalidatePath('/billing'); revalidatePath('/ledgers');
    return { ok: true, id: billId };
  } catch (err) { return toActionError(err); }
}

/**
 * Delete an invoice raised in error.
 *
 * Deliberately narrow. An invoice that has been ISSUED is in the books and has
 * been seen by a customer; deleting it would leave a hole in a numbered series,
 * which is exactly what a GST audit looks for. So an issued invoice is VOIDED —
 * it keeps its number, is marked void, and its ledger entry is reversed. Only a
 * draft that was never issued and never collected against is truly removed.
 *
 * That distinction is not pedantry: "I typed it wrong before sending it" and "I
 * sent it and the customer has it" are different problems with different
 * correct answers.
 */
export async function deleteInvoice(id: string, reason: string): Promise<BillingResult> {
  try {
    const ctx = await ensure('billing.invoice.manage');
    const why = (reason ?? '').trim();
    if (why.length < 3) return { error: 'Say why it is being removed — this is kept in the audit trail.' };

    const inv = await prisma.invoice.findUnique({
      where: { id },
      select: { id: true, number: true, status: true, total: true, amountPaid: true, clientName: true },
    });
    if (!inv) return { error: 'That invoice no longer exists.' };
    if (Number(inv.amountPaid) > 0) {
      return { error: `${inv.number} already has ${formatMoney(Number(inv.amountPaid))} collected against it. Refund or reallocate that first.` };
    }

    const entry = await prisma.journalEntry.findFirst({
      where: { sourceType: 'Invoice', sourceId: id, status: 'POSTED' },
      select: { id: true },
    });

    if (inv.status === 'DRAFT' && !entry) {
      // Never issued, never posted, nothing collected — genuinely safe to remove.
      await prisma.invoiceItem.deleteMany({ where: { invoiceId: id } });
      await prisma.invoice.delete({ where: { id } });
      await writeAudit({
        actorId: ctx.user.id, action: 'DELETE', entityType: 'Invoice', entityId: id,
        summary: `Deleted draft invoice ${inv.number} (${inv.clientName}) — ${why.slice(0, 200)}`,
      });
      revalidatePath('/billing'); revalidatePath('/ledgers');
      return { ok: true, id };
    }

    // Issued: void it and reverse the books, keeping the number in the series.
    await prisma.invoice.update({ where: { id }, data: { status: 'VOID' } });
    if (entry) {
      const { reverse } = await import('@/server/services/ledger-service');
      await reverse(entry.id, `Invoice ${inv.number} voided — ${why.slice(0, 120)}`, ctx.user.id).catch(() => undefined);
    }
    await writeAudit({
      actorId: ctx.user.id, action: 'UPDATE', entityType: 'Invoice', entityId: id,
      summary: `Voided invoice ${inv.number} (${inv.clientName}) — ${why.slice(0, 200)}`,
    });
    revalidatePath('/billing'); revalidatePath('/ledgers');
    return { ok: true, id };
  } catch (err) { return toActionError(err); }
}

function formatMoney(n: number): string {
  return `Rs ${n.toLocaleString('en-IN')}`;
}
