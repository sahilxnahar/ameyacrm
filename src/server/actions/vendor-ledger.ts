'use server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from './_helpers';
import { parseTable } from '@/lib/import/parse';
import { classifyPaymentRow, parsePaymentDate, paymentMode } from '@/lib/import/payments';
import { getActiveProject } from '@/server/services/active-project-service';
import { categorizeExpense } from '@/config/expense-categories';
import { sendViaOpenWA } from '@/server/services/whatsapp-service';

/** The company's "payments above this need a review" threshold (₹). 0 = off. */
async function paymentApprovalLimit(): Promise<number> {
  const row = await prisma.setting.findUnique({ where: { key: 'finance.payment_approval_limit' } });
  const n = Number(row?.value ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Admin sets the review threshold. */
export async function setPaymentApprovalLimit(amount: number): Promise<LedgerActionResult> {
  try {
    const ctx = await ensure('billing.bill.manage');
    const n = Math.max(0, Math.round(Number(amount) || 0));
    await prisma.setting.upsert({ where: { key: 'finance.payment_approval_limit' }, create: { key: 'finance.payment_approval_limit', value: n }, update: { value: n } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'Setting', summary: `Payment review threshold set to Rs ${n.toLocaleString('en-IN')}` });
    revalidatePath('/ledgers');
    return { ok: true };
  } catch (e) { return toActionError(e); }
}

/** Mark a flagged (over-threshold) payment as reviewed/approved. */
export async function approveVendorPayment(voucherId: string): Promise<LedgerActionResult> {
  try {
    const ctx = await ensure('billing.bill.manage');
    const v = await prisma.voucher.findUnique({ where: { id: voucherId }, select: { id: true, number: true } });
    if (!v) return { error: 'That payment no longer exists.' };
    await prisma.voucher.update({ where: { id: voucherId }, data: { status: 'POSTED', approvedById: ctx.user.id, approvedAt: new Date() } });
    await writeAudit({ actorId: ctx.user.id, action: 'APPROVE', entityType: 'Voucher', entityId: voucherId, summary: `Approved payment ${v.number}` });
    revalidatePath('/ledgers');
    return { ok: true };
  } catch (e) { return toActionError(e); }
}

export type LedgerActionResult =
  | {
      ok: true;
      created?: number;
      vendorsCreated?: number;
      skipped?: number;
      duplicates?: number;
      blanks?: number;
      badAmounts?: number;
      failed?: number;
      /** Up to a handful of plain-language notes on rows that need a look. */
      issues?: string[];
    }
  | { error: string };

const opt = (s: string) => { const t = (s ?? '').trim(); return t === '' ? null : t; };

function findCol(headers: string[], ...names: string[]): number {
  const lower = headers.map((h) => h.toLowerCase().trim());
  for (const n of names) { const i = lower.findIndex((h) => h.includes(n)); if (i >= 0) return i; }
  return -1;
}

/**
 * Import payments from a pasted or uploaded CSV (export your Google Sheet as CSV).
 * Each row becomes a payment against a payee; a new payee is created as a vendor,
 * so a **ledger per person forms automatically**.
 */
export async function importVendorPayments(text: string): Promise<LedgerActionResult> {
  try {
    const ctx = await ensure('billing.bill.manage');
    const table = parseTable(text);
    if (table.rows.length === 0) return { error: 'No rows found. Paste or upload a CSV that has a header row.' };
    const H = {
      name: findCol(table.headers, 'payee', 'vendor', 'party', 'name', 'paid to', 'to'),
      amount: findCol(table.headers, 'amount', 'paid', 'value', 'rs', 'inr', 'debit'),
      date: findCol(table.headers, 'date', 'on', 'paid on'),
      mode: findCol(table.headers, 'mode', 'method', 'type', 'via'),
      ref: findCol(table.headers, 'reference', 'ref', 'cheque', 'txn', 'transaction'),
      utr: findCol(table.headers, 'utr'),
      note: findCol(table.headers, 'note', 'narration', 'particular', 'description', 'remark'),
    };
    if (H.name < 0 || H.amount < 0) return { error: 'Need at least a payee/name column and an amount column in the header row.' };

    const vendors = await prisma.vendor.findMany({ select: { id: true, name: true } });
    const vByName = new Map(vendors.map((v) => [v.name.trim().toLowerCase(), v.id]));
    const last = await prisma.voucher.findFirst({ where: { number: { startsWith: 'CP-' } }, orderBy: { number: 'desc' }, select: { number: true } });
    let seq = last ? Number(last.number.split('-')[1] ?? '1000') : 1000;
    if (!Number.isFinite(seq)) seq = 1000;

    let created = 0, vendorsCreated = 0, duplicates = 0, blanks = 0, badAmounts = 0, failed = 0;
    const issues: string[] = [];
    const note = (msg: string) => { if (issues.length < 8) issues.push(msg); };

    // The header is row 1, so the first data row a person sees is row 2.
    let rowNum = 1;
    for (const row of table.rows) {
      rowNum++;
      // Each row is isolated: a single bad row is reported and skipped, never
      // aborting the whole import and losing the good rows before it.
      try {
        const cls = classifyPaymentRow(row[H.name] ?? '', row[H.amount] ?? '');
        if (cls.kind === 'blank') { blanks++; continue; }
        if (cls.kind === 'badAmount') { badAmounts++; note(`Row ${rowNum}: “${cls.name}” has no valid amount${cls.raw ? ` (“${cls.raw}”)` : ''} — skipped.`); continue; }
        const { name, amount } = cls;

        const key = name.toLowerCase();
        let vendorId = vByName.get(key);
        if (!vendorId) {
          const v = await prisma.vendor.create({ data: { name }, select: { id: true } });
          vendorId = v.id; vByName.set(key, vendorId); vendorsCreated++;
        }
        const reference = H.ref >= 0 ? opt(row[H.ref] ?? '') : null;
        const date = H.date >= 0 ? parsePaymentDate(row[H.date] ?? '') : null;
        const dupe = await prisma.voucher.findFirst({ where: { vendorId, amount, ...(reference ? { reference } : {}) }, select: { id: true } });
        if (dupe) { duplicates++; continue; }
        const mode = H.mode >= 0 ? paymentMode(row[H.mode] ?? '') : 'BANK_TRANSFER';
        const noteText = H.note >= 0 ? (row[H.note] ?? '').trim().slice(0, 500) || null : null;
        seq++;
        await prisma.voucher.create({
          data: {
            number: `CP-${seq}`, kind: mode === 'CASH' ? 'CASH_PAID' : 'BANK_PAID', status: 'POSTED',
            voucherDate: date ?? new Date(), partyName: name, vendorId, amount, mode,
            reference, utr: H.utr >= 0 ? opt(row[H.utr] ?? '') : null,
            narration: noteText,
            accountCode: categorizeExpense(`${name} ${noteText ?? ''}`),
            createdById: ctx.user.id,
          },
        });
        created++;
      } catch (e) {
        failed++;
        note(`Row ${rowNum}: could not import (${e instanceof Error ? e.message : 'unexpected error'}).`);
      }
    }
    const skipped = duplicates + blanks + badAmounts;
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'Voucher', entityId: 'import', summary: `Imported ${created} payments (${vendorsCreated} new payees, ${skipped} skipped, ${failed} failed)` });
    revalidatePath('/ledgers');
    return { ok: true, created, vendorsCreated, skipped, duplicates, blanks, badAmounts, failed, issues };
  } catch (e) { return toActionError(e); }
}

/** Two payees are the same person — merge their ledgers into one. */
export async function mergeVendors(keepId: string, mergeId: string): Promise<LedgerActionResult> {
  try {
    const ctx = await ensure('billing.bill.manage');
    if (!keepId || !mergeId || keepId === mergeId) return { error: 'Pick two different payees.' };
    const [keep, merge] = await Promise.all([prisma.vendor.findUnique({ where: { id: keepId } }), prisma.vendor.findUnique({ where: { id: mergeId } })]);
    if (!keep || !merge) return { error: 'One of those payees no longer exists.' };

    // All-or-nothing: every reference is repointed and the duplicate removed in
    // one transaction, so a failure part-way can never leave the ledger half-merged.
    await prisma.$transaction(async (tx) => {
      // Payments, by id and by loose name match.
      await tx.voucher.updateMany({ where: { vendorId: mergeId }, data: { vendorId: keepId, partyName: keep.name } });
      await tx.voucher.updateMany({ where: { vendorId: null, partyName: { equals: merge.name, mode: 'insensitive' } }, data: { vendorId: keepId, partyName: keep.name } });
      // Every other place a vendor is referenced — so nothing is left pointing at
      // the payee we're about to delete.
      await tx.vendorBill.updateMany({ where: { vendorId: mergeId }, data: { vendorId: keepId } });
      await tx.purchaseOrder.updateMany({ where: { vendorId: mergeId }, data: { vendorId: keepId } });
      await tx.mailThreadMessage.updateMany({ where: { vendorId: mergeId }, data: { vendorId: keepId } });
      await tx.account.updateMany({ where: { vendorId: mergeId }, data: { vendorId: keepId } });
      await tx.journalLine.updateMany({ where: { vendorId: mergeId }, data: { vendorId: keepId } });

      // Carry over bank/UPI details only where the one we're keeping has none.
      const patch: Record<string, string> = {};
      if (!keep.bankAccountNumber && merge.bankAccountNumber) { patch.bankAccountNumber = merge.bankAccountNumber; if (merge.bankIfsc) patch.bankIfsc = merge.bankIfsc; if (merge.bankName) patch.bankName = merge.bankName; if (merge.bankAccountName) patch.bankAccountName = merge.bankAccountName; }
      if (!keep.upiId && merge.upiId) patch.upiId = merge.upiId;
      if (Object.keys(patch).length) await tx.vendor.update({ where: { id: keepId }, data: patch });

      await tx.vendorPortalAccess.deleteMany({ where: { vendorId: mergeId } });
      await tx.vendor.delete({ where: { id: mergeId } });
    });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'Vendor', entityId: keepId, summary: `Merged "${merge.name}" into "${keep.name}"` });
    revalidatePath('/ledgers');
    return { ok: true };
  } catch (e) { return toActionError(e); }
}

/** Rename a payee — and keep every payment tagged to the old name in sync. */
export async function renameVendor(id: string, newName: string): Promise<LedgerActionResult> {
  try {
    const ctx = await ensure('billing.bill.manage');
    const name = newName.trim();
    if (name.length < 2) return { error: 'Give the payee a name.' };
    const vendor = await prisma.vendor.findUnique({ where: { id }, select: { id: true, name: true } });
    if (!vendor) return { error: 'That payee no longer exists.' };
    await prisma.$transaction(async (tx) => {
      await tx.voucher.updateMany({ where: { vendorId: id }, data: { partyName: name } });
      await tx.voucher.updateMany({ where: { vendorId: null, partyName: { equals: vendor.name, mode: 'insensitive' } }, data: { partyName: name, vendorId: id } });
      await tx.vendor.update({ where: { id }, data: { name } });
    });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'Vendor', entityId: id, summary: `Renamed payee "${vendor.name}" → "${name}"` });
    revalidatePath('/ledgers');
    return { ok: true };
  } catch (e) { return toActionError(e); }
}

/** Merge several payees into one keeper in a single go — the tidy-up tool. */
export async function mergeVendorsMany(keepId: string, mergeIds: string[]): Promise<LedgerActionResult> {
  try {
    await ensure('billing.bill.manage');
    const ids = [...new Set(mergeIds.filter((m) => m && m !== keepId))];
    if (!keepId || ids.length === 0) return { error: 'Pick at least one other payee to merge in.' };
    let merged = 0;
    for (const mid of ids) {
      const r = await mergeVendors(keepId, mid);
      if ('error' in r) return { error: r.error };
      merged++;
    }
    revalidatePath('/ledgers');
    return { ok: true, created: merged };
  } catch (e) { return toActionError(e); }
}

/** Save a payee's bank details, so a payment never needs them retyped. */
export async function saveVendorBank(vendorId: string, v: Record<string, string>): Promise<LedgerActionResult> {
  try {
    const ctx = await ensure('billing.bill.manage');
    await prisma.vendor.update({
      where: { id: vendorId },
      data: {
        bankAccountName: opt(v.bankAccountName ?? ''), bankAccountNumber: opt(v.bankAccountNumber ?? ''),
        bankIfsc: opt(v.bankIfsc ?? ''), bankName: opt(v.bankName ?? ''), upiId: opt(v.upiId ?? ''),
        gstin: opt(v.gstin ?? '') ?? undefined, phone: opt(v.phone ?? '') ?? undefined,
      },
    });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'Vendor', entityId: vendorId, summary: 'Updated bank details' });
    revalidatePath('/ledgers');
    return { ok: true };
  } catch (e) { return toActionError(e); }
}

async function nextCpNumber(): Promise<string> {
  const last = await prisma.voucher.findFirst({ where: { number: { startsWith: 'CP-' } }, orderBy: { number: 'desc' }, select: { number: true } });
  const n = last ? Number(last.number.split('-')[1] ?? '1000') : 1000;
  return `CP-${(Number.isFinite(n) ? n : 1000) + 1}`;
}

/**
 * Add a single payment to a payee's ledger by hand — so you never need a CSV
 * just to record one payment. Tags it to the project you're currently working
 * on, so it shows on Payments Made too. `proofUrl` is the screenshot / bank PDF.
 */
export async function addVendorPayment(input: {
  vendorId: string; amount: number | string; date?: string; mode?: string;
  reference?: string; utr?: string; note?: string; proofUrl?: string; category?: string; force?: boolean; notifyWhatsApp?: boolean;
  isAdvance?: boolean; retentionAmount?: number | string; tdsRate?: number | string;
}): Promise<{ ok: true; id?: string; flagged?: boolean } | { error: string } | { duplicate: string }> {
  try {
    const ctx = await ensure('billing.bill.manage');
    const vendor = await prisma.vendor.findUnique({ where: { id: input.vendorId }, select: { id: true, name: true, phone: true } });
    if (!vendor) return { error: 'That payee no longer exists.' };
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) return { error: 'Enter an amount above zero.' };

    const mode = input.mode ? paymentMode(input.mode) : 'BANK_TRANSFER';
    const utr = input.utr ? input.utr.replace(/[^A-Za-z0-9]/g, '').toUpperCase() : null;
    const when = input.date ? new Date(input.date) : new Date();

    // Duplicate guard — unless the user has confirmed "save anyway".
    if (!input.force) {
      if (utr) {
        const byUtr = await prisma.voucher.findFirst({ where: { utr, cancelledAt: null }, select: { number: true, partyName: true } });
        if (byUtr) return { duplicate: `A payment with UTR ${utr} is already recorded (${byUtr.number} — ${byUtr.partyName}). Save anyway?` };
      } else {
        const from = new Date(when.getTime() - 30 * 24 * 60 * 60 * 1000);
        const similar = await prisma.voucher.findFirst({
          where: { vendorId: vendor.id, amount, cancelledAt: null, voucherDate: { gte: from, lte: new Date(when.getTime() + 24 * 60 * 60 * 1000) } },
          select: { number: true, voucherDate: true },
        });
        if (similar) return { duplicate: `You already recorded ₹${amount.toLocaleString('en-IN')} to ${vendor.name} around ${similar.voucherDate.toLocaleDateString('en-IN')} (${similar.number}). Save anyway?` };
      }
    }
    const note = (input.note ?? '').trim().slice(0, 500) || null;
    const accountCode = (input.category ?? '').trim() || categorizeExpense(`${vendor.name} ${note ?? ''}`);
    const active = await getActiveProject(ctx.user.id);
    const number = await nextCpNumber();

    // Payments above the company threshold are flagged for review (DRAFT) rather
    // than posted straight away.
    const limit = await paymentApprovalLimit();
    const flagged = limit > 0 && amount > limit;

    const retentionAmount = Number(input.retentionAmount) > 0 ? Math.round(Number(input.retentionAmount) * 100) / 100 : null;
    const tdsRate = Number(input.tdsRate) > 0 ? Number(input.tdsRate) : null;
    const tdsAmount = tdsRate ? Math.round(((amount * tdsRate) / 100) * 100) / 100 : null;

    const v = await prisma.voucher.create({
      data: {
        number, kind: mode === 'CASH' ? 'CASH_PAID' : 'BANK_PAID', status: flagged ? 'DRAFT' : 'POSTED',
        voucherDate: when, paidOn: mode === 'CASH' ? null : when,
        partyName: vendor.name, vendorId: vendor.id, amount, mode,
        reference: opt(input.reference ?? ''), utr,
        utrEnteredById: utr ? ctx.user.id : null, utrEnteredAt: utr ? new Date() : null,
        narration: note,
        accountCode,
        isAdvance: Boolean(input.isAdvance),
        retentionAmount, tdsRate, tdsAmount,
        attachmentId: opt(input.proofUrl ?? ''),
        projectId: active.id ?? null,
        createdById: ctx.user.id,
      },
      select: { id: true },
    });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'Voucher', entityId: v.id, summary: `Payment ${number} to ${vendor.name} — Rs ${amount.toLocaleString('en-IN')}${flagged ? ' (flagged for review)' : ''}` });

    // Best-effort WhatsApp receipt to the vendor. Never fails the payment.
    if (input.notifyWhatsApp && !flagged && vendor.phone) {
      try {
        await sendViaOpenWA(vendor.phone, `Ameya Heights: ₹${amount.toLocaleString('en-IN')} paid on ${when.toLocaleDateString('en-IN')}${utr ? ` · UTR ${utr}` : ''}${note ? ` · ${note}` : ''}. Thank you.`);
      } catch { /* WhatsApp is a courtesy, not a requirement */ }
    }

    revalidatePath('/ledgers');
    revalidatePath('/payments');
    return { ok: true, id: v.id, flagged };
  } catch (e) { return toActionError(e); }
}

/** Mark an advance as settled (set off against a bill), or a retention as released. */
export async function settleAdvance(voucherId: string): Promise<LedgerActionResult> {
  try {
    const ctx = await ensure('billing.bill.manage');
    const v = await prisma.voucher.findUnique({ where: { id: voucherId }, select: { id: true, number: true } });
    if (!v) return { error: 'That payment no longer exists.' };
    await prisma.voucher.update({ where: { id: voucherId }, data: { advanceSettled: true } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'Voucher', entityId: voucherId, summary: `Advance ${v.number} settled` });
    revalidatePath('/ledgers');
    return { ok: true };
  } catch (e) { return toActionError(e); }
}

export async function releaseRetention(voucherId: string): Promise<LedgerActionResult> {
  try {
    const ctx = await ensure('billing.bill.manage');
    const v = await prisma.voucher.findUnique({ where: { id: voucherId }, select: { id: true, number: true } });
    if (!v) return { error: 'That payment no longer exists.' };
    await prisma.voucher.update({ where: { id: voucherId }, data: { retentionReleased: true } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'Voucher', entityId: voucherId, summary: `Retention on ${v.number} released` });
    revalidatePath('/ledgers');
    return { ok: true };
  } catch (e) { return toActionError(e); }
}

/** Set the expense category (chart-of-accounts code) on a single payment. */
export async function setPaymentCategory(voucherId: string, accountCode: string): Promise<LedgerActionResult> {
  try {
    const ctx = await ensure('billing.bill.manage');
    const v = await prisma.voucher.findUnique({ where: { id: voucherId }, select: { id: true } });
    if (!v) return { error: 'That payment no longer exists.' };
    await prisma.voucher.update({ where: { id: voucherId }, data: { accountCode: accountCode.trim() || null } });
    revalidatePath('/ledgers');
    revalidatePath('/payments');
    return { ok: true };
  } catch (e) { return toActionError(e); }
}

/** Attach (or replace) the proof file on a payment — a phone screenshot or bank PDF. */
export async function attachPaymentProof(voucherId: string, url: string): Promise<LedgerActionResult> {
  try {
    const ctx = await ensure('billing.bill.manage');
    const v = await prisma.voucher.findUnique({ where: { id: voucherId }, select: { id: true, number: true } });
    if (!v) return { error: 'That payment no longer exists.' };
    await prisma.voucher.update({ where: { id: voucherId }, data: { attachmentId: url.trim() || null } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPLOAD', entityType: 'Voucher', entityId: voucherId, summary: `Attached payment proof to ${v.number}` });
    revalidatePath('/ledgers');
    return { ok: true };
  } catch (e) { return toActionError(e); }
}
