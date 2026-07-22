'use server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from './_helpers';
import { parseTable } from '@/lib/import/parse';
import { classifyPaymentRow, parsePaymentDate, paymentMode } from '@/lib/import/payments';

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
        seq++;
        await prisma.voucher.create({
          data: {
            number: `CP-${seq}`, kind: mode === 'CASH' ? 'CASH_PAID' : 'BANK_PAID', status: 'POSTED',
            voucherDate: date ?? new Date(), partyName: name, vendorId, amount, mode,
            reference, utr: H.utr >= 0 ? opt(row[H.utr] ?? '') : null,
            narration: H.note >= 0 ? (row[H.note] ?? '').trim().slice(0, 500) || null : null,
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
