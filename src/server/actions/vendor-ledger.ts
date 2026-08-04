'use server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { can } from '@/lib/rbac/can';
import { ensure, toActionError } from './_helpers';
import { postVoucherById } from '@/lib/ledger/post-voucher';
import { paymentApprovalLimit, notifyPaymentApprovers, needsPaymentApproval } from '@/server/services/payment-approval-service';
import { nextVoucherNumber } from '@/lib/db/voucher-number';
import { parseTable } from '@/lib/import/parse';
import { classifyPaymentRow, parsePaymentDate, paymentMode } from '@/lib/import/payments';
import { getActiveProject } from '@/server/services/active-project-service';
import { categorizeExpense } from '@/config/expense-categories';
import { sendViaOpenWA } from '@/server/services/whatsapp-service';
import { notifyMany } from '@/lib/notifications/notify';
import { VENDOR_CORE_SELECT } from '@/lib/db/vendor-select';


/** Admin sets the review threshold. */
export async function setPaymentApprovalLimit(amount: number): Promise<LedgerActionResult> {
  try {
    // NOT `billing.bill.manage` — that is the permission that RAISES payments.
    // Whoever can set the threshold can set it to zero and switch approval off
    // for their own next payment, which makes the whole control theatre. The
    // person who spends and the person who sets the limit must be different.
    const ctx = await ensure('admin.setting.manage');
    const n = Math.max(0, Math.round(Number(amount) || 0));
    await prisma.setting.upsert({ where: { key: 'finance.payment_approval_limit' }, create: { key: 'finance.payment_approval_limit', value: n }, update: { value: n } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'Setting', summary: `Payment review threshold set to Rs ${n.toLocaleString('en-IN')}` });
    revalidatePath('/ledgers'); revalidatePath('/payments');
    return { ok: true };
  } catch (e) { return toActionError(e); }
}

/**
 * Approve a flagged (over-threshold) payment.
 *
 * Three things were wrong with the old version and all three mattered:
 *  · it asked for `billing.bill.manage` — the SAME permission needed to raise
 *    the payment — so the person spending the money could approve their own
 *    spend, which is not an approval, it is a formality;
 *  · it never posted to the ledger, so an approved payment updated the cash
 *    book and left the books untouched;
 *  · there was no way to say no, so a wrong payment could only be approved or
 *    abandoned as a permanent DRAFT.
 */
export async function approveVendorPayment(voucherId: string): Promise<LedgerActionResult> {
  try {
    const ctx = await ensure('billing.approve');
    const v = await prisma.voucher.findUnique({
      where: { id: voucherId },
      select: { id: true, number: true, status: true, createdById: true, amount: true, partyName: true, vendorBillId: true },
    });
    if (!v) return { error: 'That payment no longer exists.' };
    if (v.status === 'CANCELLED') return { error: `Payment ${v.number} was cancelled and cannot be approved.` };
    if (v.status !== 'DRAFT') return { error: `Payment ${v.number} is already approved.` };
    // Self-approval defeats the entire purpose of a threshold.
    if (v.createdById && v.createdById === ctx.user.id) {
      return { error: 'You raised this payment, so somebody else has to approve it.' };
    }

    await prisma.voucher.update({ where: { id: voucherId }, data: { status: 'POSTED', approvedById: ctx.user.id, approvedAt: new Date() } });
    // Only now does the money exist as far as the books are concerned.
    await postVoucherById(voucherId, ctx.user.id);
    /*
     * Anything that was held pending this payment is settled now.
     *
     * ── AMH-007 ────────────────────────────────────────────────────────────
     *
     * These two writes used to end in `.catch(() => undefined)`. By the time
     * they run the voucher is POSTED and the money is in the books — so if the
     * status flip failed, the payment had been made and the bill still read
     * CERTIFIED, i.e. unpaid. The next person to look at the bill list sees an
     * outstanding bill and pays it again. That is AMH-001's double payment
     * reached by a different road, and it left no trace at all.
     *
     * Rolling back is not available here: the ledger entry is already written,
     * and reversing a posted voucher because a status column did not update
     * would be a worse cure. So the failure is reported instead — loudly, with
     * the voucher number, so the two records can be reconciled by hand.
     */
    const settlementFailures: string[] = [];
    try {
      await prisma.raBill.updateMany({ where: { voucherId, status: 'CERTIFIED' }, data: { status: 'PAID' } });
    } catch (err) {
      settlementFailures.push(`RA bill(s) against ${v.number}: ${err instanceof Error ? err.message : 'update failed'}`);
    }
    if (v.vendorBillId) {
      try {
        await prisma.vendorBill.update({ where: { id: v.vendorBillId }, data: { status: 'PAID' } });
      } catch (err) {
        settlementFailures.push(`supplier bill ${v.vendorBillId}: ${err instanceof Error ? err.message : 'update failed'}`);
      }
      const { closeMsmeClockForBill } = await import('@/server/services/msme-service');
      await closeMsmeClockForBill(v.vendorBillId, voucherId);
    }
    if (settlementFailures.length) {
      // The audit trail is the reconciliation record — it must say the money
      // moved AND that the bill was not marked, because those are the two
      // halves somebody will have to put back together.
      await writeAudit({
        actorId: ctx.user.id, action: 'APPROVE', entityType: 'Voucher', entityId: voucherId,
        summary: `Payment ${v.number} was POSTED but the bill could not be marked paid — ${settlementFailures.join('; ')}. The bill still reads unpaid; do not pay it twice.`,
      }).catch(() => undefined);
      revalidatePath('/ledgers'); revalidatePath('/payments');
      return {
        error: `Payment ${v.number} went through and is in the books, but the bill could not be marked paid. `
          + 'It will still look unpaid — do NOT pay it again. Mark it paid by hand, or reload and check before retrying.',
      };
    }
    await writeAudit({ actorId: ctx.user.id, action: 'APPROVE', entityType: 'Voucher', entityId: voucherId, summary: `Approved payment ${v.number} to ${v.partyName} — Rs ${Number(v.amount).toLocaleString('en-IN')}` });
    if (v.createdById) {
      await notifyMany([v.createdById], { type: 'APPROVAL', title: `Payment ${v.number} approved`, link: '/payments' }).catch(() => undefined);
    }
    revalidatePath('/ledgers'); revalidatePath('/payments');
    return { ok: true };
  } catch (e) { return toActionError(e); }
}

/**
 * Square the books when a payment is withdrawn.
 *
 * "Nothing to reverse" and "the reversal failed" used to be the same answer —
 * null — and every caller treated both as success. A payment removed while its
 * ledger entry survived is money missing from the cash book and still sitting in
 * the trial balance, silently and for good.
 */
type Reversal = { state: 'none' } | { state: 'reversed'; number: string } | { state: 'failed'; why: string };

async function reverseLedgerFor(voucherId: string, actorId: string, why: string): Promise<Reversal> {
  try {
    const entry = await prisma.journalEntry.findFirst({
      where: { sourceType: 'Voucher', sourceId: voucherId, status: 'POSTED' },
      select: { id: true },
    });
    if (!entry) return { state: 'none' };
    const { reverse } = await import('@/server/services/ledger-service');
    const r = await reverse(entry.id, why, actorId);
    return 'ok' in r ? { state: 'reversed', number: r.number ?? 'a reversing entry' } : { state: 'failed', why: r.error };
  } catch (e) {
    return { state: 'failed', why: e instanceof Error ? e.message : 'the ledger could not be squared' };
  }
}

/**
 * Let go of whatever was waiting on a payment that is not going to happen.
 *
 * An RA bill sits with `voucherId` set while its settlement waits; a piece-rate
 * entry and a vendor bill the same. If the payment is turned down, cancelled or
 * deleted and nothing releases those, `settleRaBill` answers "already settled"
 * for ever and the contractor can never be paid.
 *
 * The LINK is deliberately kept. Nulling it was the obvious move and it was
 * wrong: restoring the payment afterwards could not re-take the hold, so a
 * rejected-then-restored settlement could be raised a second time and the
 * contractor paid twice. The settle guards ask instead what state the linked
 * voucher is in — a cancelled voucher is not a settlement — so the link and the
 * truth cannot drift apart.
 */
async function releaseHoldsFor(voucherId: string): Promise<void> {
  const v = await prisma.voucher.findUnique({ where: { id: voucherId }, select: { vendorBillId: true } }).catch(() => null);
  await prisma.raBill.updateMany({ where: { voucherId, status: 'PAID' }, data: { status: 'CERTIFIED' } }).catch(() => undefined);
  if (v?.vendorBillId) {
    await prisma.vendorBill.update({ where: { id: v.vendorBillId }, data: { status: 'DRAFT' } }).catch(() => undefined);
    // The bill is unpaid again, so the statutory clock starts running again.
    const { reopenMsmeClockForBill } = await import('@/server/services/msme-service');
    await reopenMsmeClockForBill(v.vendorBillId);
  }
}

/** Turn a flagged payment down, with a reason. The number stays; nothing is deleted. */
export async function rejectVendorPayment(voucherId: string, reason: string): Promise<LedgerActionResult> {
  try {
    const ctx = await ensure('billing.approve');
    const why = (reason ?? '').trim();
    if (why.length < 3) return { error: 'Say why it is being turned down — the person who raised it needs to know.' };
    const v = await prisma.voucher.findUnique({
      where: { id: voucherId }, select: { id: true, number: true, status: true, createdById: true },
    });
    if (!v) return { error: 'That payment no longer exists.' };
    if (v.status !== 'DRAFT') return { error: `Payment ${v.number} is not awaiting approval.` };

    await prisma.voucher.update({
      where: { id: voucherId },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: `Not approved: ${why.slice(0, 280)}` },
    });
    await releaseHoldsFor(voucherId);
    await writeAudit({ actorId: ctx.user.id, action: 'REJECT', entityType: 'Voucher', entityId: voucherId, summary: `Rejected payment ${v.number} — ${why.slice(0, 200)}` });
    if (v.createdById) {
      await notifyMany([v.createdById], { type: 'APPROVAL', title: `Payment ${v.number} was not approved`, body: why.slice(0, 200), link: '/payments' }).catch(() => undefined);
    }
    revalidatePath('/ledgers'); revalidatePath('/payments');
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
      /** Said out loud when the action succeeded but left something to fix. */
      message?: string;
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
        // Same payee and same amount is NOT a duplicate on its own — twelve
        // months of identical rent is twelve payments. Without a reference to
        // match on, only a payment on the same DAY counts as a re-paste.
        const when = date ?? new Date();
        const dayStart = new Date(when); dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(when); dayEnd.setHours(23, 59, 59, 999);
        const dupe = await prisma.voucher.findFirst({
          where: reference
            ? { vendorId, amount, reference }
            : { vendorId, amount, voucherDate: { gte: dayStart, lte: dayEnd } },
          select: { id: true },
        });
        if (dupe) { duplicates++; continue; }
        const mode = H.mode >= 0 ? paymentMode(row[H.mode] ?? '') : 'BANK_TRANSFER';
        const noteText = H.note >= 0 ? (row[H.note] ?? '').trim().slice(0, 500) || null : null;
        const imported = await prisma.voucher.create({
          data: {
            number: await nextVoucherNumber('CP'), kind: mode === 'CASH' ? 'CASH_PAID' : 'BANK_PAID', status: 'POSTED',
            voucherDate: date ?? new Date(), partyName: name, vendorId, amount, mode,
            reference, utr: H.utr >= 0 ? opt(row[H.utr] ?? '') : null,
            narration: noteText,
            accountCode: categorizeExpense(`${name} ${noteText ?? ''}`),
            createdById: ctx.user.id,
          },
          select: { id: true },
        });
        await postVoucherById(imported.id, ctx.user.id);
        created++;
      } catch (e) {
        failed++;
        note(`Row ${rowNum}: could not import (${e instanceof Error ? e.message : 'unexpected error'}).`);
      }
    }
    const skipped = duplicates + blanks + badAmounts;
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'Voucher', entityId: 'import', summary: `Imported ${created} payments (${vendorsCreated} new payees, ${skipped} skipped, ${failed} failed)` });
    revalidatePath('/ledgers'); revalidatePath('/payments');
    return { ok: true, created, vendorsCreated, skipped, duplicates, blanks, badAmounts, failed, issues };
  } catch (e) { return toActionError(e); }
}

/** Two payees are the same person — merge their ledgers into one. */
export async function mergeVendors(keepId: string, mergeId: string): Promise<LedgerActionResult> {
  try {
    const ctx = await ensure('billing.bill.manage');
    if (!keepId || !mergeId || keepId === mergeId) return { error: 'Pick two different payees.' };
    const [keep, merge] = await Promise.all([
      prisma.vendor.findUnique({ where: { id: keepId }, select: VENDOR_CORE_SELECT }),
      prisma.vendor.findUnique({ where: { id: mergeId }, select: VENDOR_CORE_SELECT }),
    ]);
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
    revalidatePath('/ledgers'); revalidatePath('/payments');
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
    revalidatePath('/ledgers'); revalidatePath('/payments');
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
    revalidatePath('/ledgers'); revalidatePath('/payments');
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
    revalidatePath('/ledgers'); revalidatePath('/payments');
    return { ok: true };
  } catch (e) { return toActionError(e); }
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
    const number = await nextVoucherNumber('CP');

    // Payments above the company threshold are flagged for review (DRAFT) rather
    // than posted straight away.
    const limit = await paymentApprovalLimit();
    const flagged = limit > 0 && amount > limit;

    const retentionAmount = Number(input.retentionAmount) > 0 ? Math.round(Number(input.retentionAmount) * 100) / 100 : null;
    const tdsRate = Number(input.tdsRate) > 0 ? Number(input.tdsRate) : null;
    // TDS is a percentage OF THE BILL, so it is computed on what was entered.
    const tdsAmount = tdsRate ? Math.round(((amount * tdsRate) / 100) * 100) / 100 : null;

    // `Voucher.amount` is money that actually moved — that is what the cash
    // book, the payments screen and every spend report mean by it, and what the
    // RA-bill path already stores. The form asks for the BILL and then holds TDS
    // and retention back from it, so the cheque is smaller than the number typed.
    // Storing the bill value here overstated cash out by the deductions on every
    // such payment and made bank reconciliation impossible; the ledger then
    // reconstructed a gross that was too high by the same amount.
    const withheld = (tdsAmount ?? 0) + (retentionAmount ?? 0);
    const paidOut = Math.round((amount - withheld) * 100) / 100;
    if (paidOut < 0) return { error: 'The TDS and retention come to more than the payment itself.' };

    const v = await prisma.voucher.create({
      data: {
        number, kind: mode === 'CASH' ? 'CASH_PAID' : 'BANK_PAID', status: flagged ? 'DRAFT' : 'POSTED',
        voucherDate: when, paidOn: mode === 'CASH' ? null : when,
        partyName: vendor.name, vendorId: vendor.id, amount: paidOut, mode,
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
    // A payment parked as DRAFT for review has not happened yet — posting it
    // would put money in the books that nobody has approved. It posts on approval.
    if (!flagged) await postVoucherById(v.id, ctx.user.id);
    else await notifyPaymentApprovers(v.id, ctx.user.id, `${number} · ${vendor.name} · Rs ${amount.toLocaleString('en-IN')}`);
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'Voucher', entityId: v.id, summary: `Payment ${number} to ${vendor.name} — Rs ${amount.toLocaleString('en-IN')}${flagged ? ' (flagged for review)' : ''}` });

    // Best-effort WhatsApp receipt to the vendor. Never fails the payment.
    if (input.notifyWhatsApp && !flagged && vendor.phone) {
      try {
        await sendViaOpenWA(vendor.phone, `Ameya Heights: ₹${amount.toLocaleString('en-IN')} paid on ${when.toLocaleDateString('en-IN')}${utr ? ` · UTR ${utr}` : ''}${note ? ` · ${note}` : ''}. Thank you.`);
      } catch { /* WhatsApp is a courtesy, not a requirement */ }
    }

    revalidatePath('/ledgers'); revalidatePath('/payments');
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
    revalidatePath('/ledgers'); revalidatePath('/payments');
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
    revalidatePath('/ledgers'); revalidatePath('/payments');
    return { ok: true };
  } catch (e) { return toActionError(e); }
}

/** Remove a payment from the ledger — soft-cancelled, so the record survives. */
export async function deleteVendorPayment(voucherId: string): Promise<LedgerActionResult> {
  try {
    const ctx = await ensure('billing.bill.manage');
    const v = await prisma.voucher.findUnique({ where: { id: voucherId }, select: { id: true, number: true } });
    if (!v) return { error: 'That payment no longer exists.' };
    await prisma.voucher.update({ where: { id: voucherId }, data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: 'Removed from vendor ledger' } });
    // Cancelling the voucher without reversing its journal entry leaves the
    // money out of the cash book and still in the trial balance.
    const reversal = await reverseLedgerFor(voucherId, ctx.user.id, `Payment ${v.number} removed`);
    await releaseHoldsFor(voucherId);
    await writeAudit({
      actorId: ctx.user.id, action: 'DELETE', entityType: 'Voucher', entityId: voucherId,
      summary: `Removed payment ${v.number}${reversal.state === 'reversed' ? ` (ledger entry reversed by ${reversal.number})` : reversal.state === 'failed' ? ` — LEDGER NOT REVERSED: ${reversal.why}` : ''}`,
    });
    if (reversal.state === 'failed') {
      revalidatePath('/ledgers'); revalidatePath('/payments');
      return { ok: true, message: `Payment removed, but its ledger entry could NOT be reversed (${reversal.why}). The trial balance still contains it — fix that account and reverse the entry from the ledger screen.` };
    }
    revalidatePath('/ledgers'); revalidatePath('/payments');
    return { ok: true };
  } catch (e) { return toActionError(e); }
}

/**
 * Permanently delete a payment — gone for good, no undo.
 *
 * Reserved for an administrator: the everyday "delete" soft-cancels (and can be
 * restored), which keeps the audit trail intact. This is the escape hatch for a
 * genuine mistake — a test entry, a duplicate imported twice — that should not
 * linger as a CANCELLED row forever. Voucher has no hard foreign keys pointing
 * at it, so the row can be removed cleanly. The deletion itself is still audited.
 */
export async function hardDeleteVendorPayment(voucherId: string): Promise<LedgerActionResult> {
  try {
    const ctx = await ensure('billing.bill.manage');
    if (!ctx.permissions.isSuperAdmin && !can(ctx.permissions, 'admin.setting.manage')) {
      return { error: 'Only an administrator can permanently delete a payment. You can still remove it (which keeps a cancelled record).' };
    }
    const v = await prisma.voucher.findUnique({ where: { id: voucherId }, select: { id: true, number: true, partyName: true, amount: true } });
    if (!v) return { error: 'That payment no longer exists.' };
    // The journal entry points at this voucher by id and outlives it, so the
    // books must be squared BEFORE the row disappears — otherwise the cash book
    // loses the payment while the trial balance keeps it, untraceably.
    const reversal = await reverseLedgerFor(voucherId, ctx.user.id, `Payment ${v.number} permanently deleted`);
    if (reversal.state === 'failed') {
      // Deleting the row now would orphan a live journal entry whose source no
      // longer exists — untraceable, and permanent. Refuse instead.
      return { error: `Its ledger entry could not be reversed (${reversal.why}), and deleting the payment would leave that entry in the books with nothing to trace it back to. Reverse the entry from the ledger screen first.` };
    }
    await releaseHoldsFor(voucherId);
    await prisma.voucher.delete({ where: { id: voucherId } });
    await writeAudit({
      actorId: ctx.user.id, action: 'DELETE', entityType: 'Voucher', entityId: voucherId,
      summary: `PERMANENTLY deleted payment ${v.number} — ${v.partyName}, Rs ${Number(v.amount).toLocaleString('en-IN')}`,
    });
    revalidatePath('/ledgers'); revalidatePath('/payments'); revalidatePath('/cash-book');
    return { ok: true };
  } catch (e) { return toActionError(e); }
}

/** Undo a removal. */
export async function restoreVendorPayment(voucherId: string): Promise<LedgerActionResult> {
  try {
    const ctx = await ensure('billing.bill.manage');
    const v = await prisma.voucher.findUnique({ where: { id: voucherId }, select: { id: true, number: true, amount: true, status: true, cancelReason: true } });
    if (!v) return { error: 'That payment no longer exists.' };
    if (v.status !== 'CANCELLED') return { error: `Payment ${v.number} is not cancelled, so there is nothing to restore.` };

    // Restore is not a back door around approval.
    //
    // It used to set POSTED unconditionally, on the same permission needed to
    // RAISE a payment — so the person who raised a payment an approver had just
    // turned down could restore it themselves, fully posted, with no approver
    // recorded. A payment that was rejected has to go back for approval, and one
    // above the threshold has to be approved regardless of how it got cancelled.
    const wasRejected = (v.cancelReason ?? '').startsWith('Not approved:');
    const needsApproval = wasRejected || (await needsPaymentApproval(Number(v.amount)));

    await prisma.voucher.update({
      where: { id: voucherId },
      data: { status: needsApproval ? 'DRAFT' : 'POSTED', cancelledAt: null, cancelReason: null },
    });
    // It was cancelled, so it is not in the books; restoring it has to put it there.
    if (needsApproval) await notifyPaymentApprovers(voucherId, ctx.user.id, `${v.number} · restored · Rs ${Number(v.amount).toLocaleString('en-IN')}`);
    else await postVoucherById(voucherId, ctx.user.id);

    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'Voucher', entityId: voucherId, summary: `Restored payment ${v.number}${needsApproval ? ' — back to awaiting approval' : ''}` });
    revalidatePath('/ledgers'); revalidatePath('/payments');
    return { ok: true };
  } catch (e) { return toActionError(e); }
}

/** Reclassify a payment as cash — it then shows as a cash entry in the Cash Book. */
export async function reclassifyPaymentToCash(voucherId: string): Promise<LedgerActionResult> {
  try {
    const ctx = await ensure('billing.bill.manage');
    const v = await prisma.voucher.findUnique({ where: { id: voucherId }, select: { id: true, number: true } });
    if (!v) return { error: 'That payment no longer exists.' };
    await prisma.voucher.update({ where: { id: voucherId }, data: { kind: 'CASH_PAID', mode: 'CASH', utr: null, bankName: null, paidOn: null } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'Voucher', entityId: voucherId, summary: `Moved ${v.number} to cash` });
    revalidatePath('/ledgers'); revalidatePath('/payments'); revalidatePath('/cash-book');
    return { ok: true };
  } catch (e) { return toActionError(e); }
}

/** Reclassify a payment as a bank payment — the mirror of "To cash", so any
 *  payment can be moved either way. Leaves the UTR blank for you to fill in. */
export async function reclassifyPaymentToBank(voucherId: string): Promise<LedgerActionResult> {
  try {
    const ctx = await ensure('billing.bill.manage');
    const v = await prisma.voucher.findUnique({ where: { id: voucherId }, select: { id: true, number: true, paidOn: true, voucherDate: true } });
    if (!v) return { error: 'That payment no longer exists.' };
    await prisma.voucher.update({ where: { id: voucherId }, data: { kind: 'BANK_PAID', mode: 'BANK_TRANSFER', paidOn: v.paidOn ?? v.voucherDate } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'Voucher', entityId: voucherId, summary: `Moved ${v.number} to bank` });
    revalidatePath('/ledgers'); revalidatePath('/payments'); revalidatePath('/cash-book');
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
    revalidatePath('/ledgers'); revalidatePath('/payments');
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
    revalidatePath('/ledgers'); revalidatePath('/payments');
    return { ok: true };
  } catch (e) { return toActionError(e); }
}

/**
 * The books' backlog: money in the cash book that never reached the ledger.
 *
 * Posting is deliberately non-fatal — a payment must be recordable before the
 * chart of accounts exists — but "non-fatal" only works if the failures are
 * visible and clearable. Without this the audit line "saved but NOT posted" was
 * the only trace, and the trial balance was quietly short for good.
 */
export async function unpostedLedgerBacklog(): Promise<{ ok: true; count: number; total: number; rows: { id: string; number: string; partyName: string; amount: number; date: string }[] } | { error: string }> {
  try {
    // Only somebody who can act on it — this runs on every mount of the ledger
    // screen, and there is no point costing a query for a banner the caller
    // would not be shown.
    await ensure('billing.bill.manage');
    const { unpostedVoucherCount, unpostedVouchers } = await import('@/lib/ledger/post-voucher');
    const summary = await unpostedVoucherCount();
    if (summary.count === 0) return { ok: true, count: 0, total: 0, rows: [] };
    const rows = await unpostedVouchers(50);
    return {
      ok: true,
      count: summary.count,
      total: summary.total,
      rows: rows.map((r) => ({ id: r.id, number: r.number, partyName: r.partyName, amount: r.amount, date: r.voucherDate.toISOString() })),
    };
  } catch (e) { return toActionError(e) as { error: string }; }
}

/** Try the backlog again. Safe to run as often as you like. */
export async function postLedgerBacklog(): Promise<{ ok: true; message: string } | { error: string }> {
  try {
    const ctx = await ensure('finance.ledger.manage');
    const { postUnposted } = await import('@/lib/ledger/post-voucher');
    const r = await postUnposted(ctx.user.id, 200);
    if (r.attempted === 0) return { ok: true, message: 'Nothing waiting — every payment is in the ledger.' };
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'JournalEntry', entityId: 'backlog', summary: `Ledger catch-up — ${r.posted} of ${r.attempted} posted` });
    revalidatePath('/ledgers'); revalidatePath('/accounts');
    return {
      ok: true,
      message: r.posted === r.attempted
        ? `${r.posted} payment${r.posted === 1 ? '' : 's'} posted to the ledger.`
        : `${r.posted} of ${r.attempted} posted. The rest still cannot be — usually a missing or switched-off account.`,
    };
  } catch (e) { return toActionError(e) as { error: string }; }
}
