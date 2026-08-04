'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { ensure, toActionError } from '@/server/actions/_helpers';
import { activeTallyCompanyId } from '@/lib/tally/company';
import { writeAudit } from '@/lib/audit/log';
import { getBillWiseReport, getOpenBillsFor, type BillWiseReport, type OpenBill } from '@/server/services/tally-bills-service';

export type BillResult = { ok: true; id?: string; message?: string } | { error: string };

/** The bill-wise outstanding report for the active company. */
export async function tallyBillWise(): Promise<{ ok: true; report: BillWiseReport } | { error: string }> {
  try {
    await ensure('finance.ledger.view');
    return { ok: true, report: await getBillWiseReport(await activeTallyCompanyId()) };
  } catch (e) { return toActionError(e); }
}

/** Open bills on one party, for allocating a receipt or payment against. */
export async function tallyOpenBills(ledgerId: string): Promise<{ ok: true; bills: OpenBill[] } | { error: string }> {
  try {
    await ensure('finance.ledger.view');
    return { ok: true, bills: await getOpenBillsFor(await activeTallyCompanyId(), ledgerId) };
  } catch (e) { return toActionError(e); }
}

const billSchema = z.object({
  ledgerId: z.string().min(1, 'Choose the party'),
  reference: z.string().min(1, 'Give the bill a reference').max(60),
  billDate: z.string().min(1),
  dueDate: z.string().optional().or(z.literal('')),
  amount: z.coerce.number().positive('Enter an amount'),
  kind: z.enum(['RECEIVABLE', 'PAYABLE']),
  narration: z.string().max(300).optional().or(z.literal('')),
});

/**
 * Record a bill against a party.
 *
 * The reference is what the two sides quote at each other — an invoice number,
 * a demand number, a running-bill number. It is unique per party per company,
 * so raising the same reference twice is caught rather than quietly creating a
 * second copy of the same debt.
 */
export async function createTallyBill(input: unknown): Promise<BillResult> {
  try {
    const ctx = await ensure('finance.ledger.manage');
    const d = billSchema.parse(input);
    const companyId = await activeTallyCompanyId();

    const ledger = await prisma.tallyLedger.findFirst({
      where: { id: d.ledgerId, companyId }, select: { id: true, name: true },
    });
    if (!ledger) return { error: 'That party is not in this company’s books.' };

    const clash = await prisma.tallyBill.findFirst({
      where: { companyId, ledgerId: d.ledgerId, reference: d.reference.trim() }, select: { id: true },
    });
    if (clash) return { error: `${ledger.name} already has a bill referenced ${d.reference.trim()}.` };

    const bill = await prisma.tallyBill.create({
      data: {
        companyId, ledgerId: d.ledgerId, reference: d.reference.trim(),
        billDate: new Date(d.billDate),
        dueDate: d.dueDate ? new Date(d.dueDate) : null,
        amount: d.amount, kind: d.kind, narration: d.narration || null,
      },
      select: { id: true },
    });

    await writeAudit({
      actorId: ctx.user.id, action: 'CREATE', entityType: 'TallyBill', entityId: bill.id,
      summary: `Bill ${d.reference.trim()} for ₹${d.amount.toLocaleString('en-IN')} on ${ledger.name}`,
    });
    revalidatePath('/tally');
    return { ok: true, id: bill.id };
  } catch (e) { return toActionError(e); }
}

const allocSchema = z.object({
  voucherId: z.string().min(1),
  allocations: z.array(z.object({
    billId: z.string().min(1),
    amount: z.coerce.number().positive(),
  })).min(1, 'Set at least one amount against a bill'),
});

/**
 * Set money against specific bills.
 *
 * This is the whole point of bill-wise tracking. Without it, a payment is only
 * a change in the party's total and the software has to guess which bill it
 * settled — invariably oldest-first, which is wrong the moment somebody pays
 * the third instalment while disputing the second.
 *
 * Over-allocation is refused rather than clamped: if the figures do not fit,
 * the accountant has misread something and should see that, not have the
 * software quietly absorb it.
 */
export async function allocateToBills(input: unknown): Promise<BillResult> {
  try {
    const ctx = await ensure('finance.ledger.manage');
    const d = allocSchema.parse(input);
    const companyId = await activeTallyCompanyId();

    const voucher = await prisma.tallyVoucher.findFirst({
      where: { id: d.voucherId, companyId }, select: { id: true, type: true, number: true },
    });
    if (!voucher) return { error: 'That voucher is not in this company’s books.' };

    // Existence and company scope only — the amounts are re-read inside the
    // transaction below, because anything read out here can be stale by the
    // time it is written.
    const bills = await prisma.tallyBill.findMany({
      where: { id: { in: d.allocations.map((a) => a.billId) }, companyId },
      select: { id: true },
    });
    if (bills.length !== d.allocations.length) return { error: 'One of those bills no longer exists.' };

    /*
     * Re-check the outstanding amount INSIDE the transaction.
     *
     * The check used to run out here, against rows read before the transaction
     * opened, and the transaction itself never looked again. Two people
     * allocating ₹50,000 each against a ₹60,000 bill both passed and both
     * wrote — ₹100,000 set against ₹60,000, after which the bill register and
     * the ledger disagree and the difference has to be found by hand.
     *
     * Money is compared in integer paise rather than rupees as a float. The old
     * `open + 0.005` fudge was an admission that a float comparison was driving
     * a control decision; at paise scale the comparison is exact and the fudge
     * is unnecessary.
     */
    const paise = (n: number) => Math.round(n * 100);
    const attempt = () => prisma.$transaction(async (tx) => {
      for (const a of d.allocations) {
        const bill = await tx.tallyBill.findUnique({
          where: { id: a.billId },
          select: { amount: true, reference: true, allocations: { select: { amount: true } } },
        });
        if (!bill) return 'One of those bills no longer exists.';
        const settled = bill.allocations.reduce((s, x) => s + paise(Number(x.amount)), 0);
        const open = paise(Number(bill.amount)) - settled;
        if (paise(a.amount) > open) {
          return `${bill.reference} only has ₹${(open / 100).toLocaleString('en-IN')} outstanding — you cannot set ₹${a.amount.toLocaleString('en-IN')} against it.`;
        }
        await tx.tallyBillAllocation.create({ data: { billId: a.billId, voucherId: d.voucherId, amount: a.amount } });
      }
      return null;
    }, { isolationLevel: 'Serializable' });

    /*
     * Serializable isolation is what makes the re-check above trustworthy, and
     * its cost is that Postgres aborts one of two genuinely concurrent
     * transactions with a serialization failure. That is not a user error and
     * must not be shown as one — the correct response is to run it again, at
     * which point the loser sees the winner's allocation and either fits or is
     * told the bill is now short. One retry is enough for two writers; beyond
     * that the contention is real and worth surfacing.
     */
    let failure: string | null;
    try {
      failure = await attempt();
    } catch {
      // Staggered, not immediate. Two writers that abort together and retry
      // together simply collide again; a short random pause lets one land.
      await new Promise((r) => setTimeout(r, 40 + Math.floor(Math.random() * 120)));
      failure = await attempt().catch(
        () => 'Another allocation was being saved at the same moment. Nothing was changed — try again.',
      );
    }
    if (failure) return { error: failure };

    const total = d.allocations.reduce((s, a) => s + a.amount, 0);
    await writeAudit({
      actorId: ctx.user.id, action: 'UPDATE', entityType: 'TallyVoucher', entityId: d.voucherId,
      summary: `₹${total.toLocaleString('en-IN')} from ${voucher.type} #${voucher.number} set against ${d.allocations.length} bill(s)`,
    });
    revalidatePath('/tally');
    return { ok: true, message: `₹${total.toLocaleString('en-IN')} allocated.` };
  } catch (e) { return toActionError(e); }
}

/** Undo one allocation — the money goes back to being unallocated. */
export async function removeBillAllocation(allocationId: string): Promise<BillResult> {
  try {
    const ctx = await ensure('finance.ledger.manage');
    const companyId = await activeTallyCompanyId();
    const alloc = await prisma.tallyBillAllocation.findFirst({
      where: { id: allocationId, bill: { companyId } },
      include: { bill: { select: { reference: true } } },
    });
    if (!alloc) return { error: 'That allocation no longer exists.' };

    await prisma.tallyBillAllocation.delete({ where: { id: allocationId } });
    await writeAudit({
      actorId: ctx.user.id, action: 'UPDATE', entityType: 'TallyBill', entityId: alloc.billId,
      summary: `Removed ₹${Number(alloc.amount).toLocaleString('en-IN')} set against ${alloc.bill.reference}`,
    });
    revalidatePath('/tally');
    return { ok: true };
  } catch (e) { return toActionError(e); }
}
