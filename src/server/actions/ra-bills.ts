'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { notify } from '@/lib/notifications/notify';
import { computeRaBill } from '@/lib/construction/ra-bill';
import { vendorComplianceStatus, monthKey } from '@/server/services/labour-compliance-service';
import { vendorAdvanceFrozen } from '@/server/services/insolvency-service';
import { vendorMsmeOverdue } from '@/server/services/msme-service';
import { nextSequence } from '@/lib/db/sequence';
import { structuralCertificationGate } from '@/server/services/structural-contract-service';
import { ensure, toActionError } from './_helpers';

export type RaResult = { ok: true; id?: string; message?: string } | { error: string };

const lineSchema = z.object({
  description: z.string().min(1).max(300),
  unit: z.string().max(20).optional(),
  qty: z.coerce.number().min(0).default(0),
  rate: z.coerce.number().min(0).default(0),
});

const createSchema = z.object({
  contractId: z.string().optional(),
  vendorId: z.string().optional(),
  projectId: z.string().optional(),
  periodFrom: z.string().optional(),
  periodTo: z.string().optional(),
  grossValue: z.coerce.number().min(0),
  deductions: z.coerce.number().min(0).default(0),
  cessPercent: z.coerce.number().min(0).max(100).default(1),
  retentionPercent: z.coerce.number().min(0).max(100).default(5),
  tdsSection: z.string().optional(),
  narration: z.string().max(500).optional(),
  lines: z.array(lineSchema).max(100).optional(),
});

async function nextRaNumber(): Promise<{ number: string; billNo: number }> {
  const last = await prisma.raBill.findFirst({ where: { number: { startsWith: 'RA-' } }, orderBy: { number: 'desc' }, select: { number: true } });
  const seq = last ? Number(last.number.split('-')[1] ?? '1000') : 1000;
  const n = (Number.isFinite(seq) ? seq : 1000) + 1;
  return { number: `RA-${n}`, billNo: n - 1000 };
}

/** Create a draft RA bill, computing cess / retention / TDS on the certified gross. */
export async function createRaBill(input: unknown): Promise<RaResult> {
  try {
    const ctx = await ensure('procurement.manage');
    const d = createSchema.parse(input);

    let hasPan = true;
    let tdsSection = d.tdsSection || '194C';
    if (d.vendorId) {
      const v = await prisma.vendor.findUnique({ where: { id: d.vendorId }, select: { pan: true, defaultTdsSection: true } });
      hasPan = !!(v?.pan && v.pan.trim());
      if (!d.tdsSection && v?.defaultTdsSection) tdsSection = v.defaultTdsSection;
    }

    const c = computeRaBill({
      grossValue: d.grossValue, deductions: d.deductions, cessPercent: d.cessPercent,
      retentionPercent: d.retentionPercent, tdsSection, hasPan,
    });
    const { number, billNo } = await nextRaNumber();

    const bill = await prisma.raBill.create({
      data: {
        number, billNo, contractId: d.contractId || null, vendorId: d.vendorId || null, projectId: d.projectId || null,
        periodFrom: d.periodFrom ? new Date(d.periodFrom) : null, periodTo: d.periodTo ? new Date(d.periodTo) : null,
        grossValue: d.grossValue, deductions: d.deductions, cessPercent: d.cessPercent, cessAmount: c.cessAmount,
        retentionPercent: d.retentionPercent, retentionAmount: c.retentionAmount,
        tdsSection: c.tdsSection, tdsRate: c.tdsRate, tdsAmount: c.tdsAmount, netPayable: c.netPayable,
        narration: d.narration || null, createdById: ctx.user.id,
        lines: d.lines && d.lines.length
          ? { create: d.lines.map((l) => ({ description: l.description, unit: l.unit || null, qty: l.qty, rate: l.rate, amount: Math.round(l.qty * l.rate) })) }
          : undefined,
      },
    });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'RaBill', entityId: bill.id, summary: `Created ${number} (gross ₹${Math.round(d.grossValue)})` });
    revalidatePath('/ra-bills');
    return { ok: true, id: bill.id };
  } catch (err) { return toActionError(err); }
}

/** Submit a draft RA bill for Independent-Engineer certification via the approval engine. */
export async function submitRaBill(id: string, approverIds: string[]): Promise<RaResult> {
  try {
    const ctx = await ensure('procurement.manage');
    const billId = z.string().min(1).parse(id);
    const ids = z.array(z.string().min(1)).min(1).max(6).parse(approverIds);
    const bill = await prisma.raBill.findUnique({ where: { id: billId }, select: { status: true, number: true } });
    if (!bill) return { error: 'RA bill not found.' };
    if (bill.status !== 'DRAFT' && bill.status !== 'REJECTED') return { error: 'Only a draft can be submitted.' };

    await prisma.approvalRequest.create({
      data: { entityType: 'RA_BILL', entityId: billId, requesterId: ctx.user.id, steps: { create: ids.map((approverId, i) => ({ approverId, sequence: i + 1 })) } },
    });
    await prisma.raBill.update({ where: { id: billId }, data: { status: 'PENDING' } });
    for (const approverId of ids) {
      await notify({ userId: approverId, type: 'APPROVAL', title: `Certify RA bill ${bill.number}`, link: '/approvals' }).catch(() => undefined);
    }
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'RaBill', entityId: billId, summary: `Submitted ${bill.number} for certification` });
    revalidatePath('/ra-bills');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

/** Settle a certified RA bill: raise a payment voucher for the net, carrying the TDS. */
export async function settleRaBill(id: string): Promise<RaResult> {
  try {
    const ctx = await ensure('finance.ledger.manage');
    const billId = z.string().min(1).parse(id);
    const bill = await prisma.raBill.findUnique({ where: { id: billId } });
    if (!bill) return { error: 'RA bill not found.' };
    if (bill.status !== 'CERTIFIED') return { error: 'Only a certified RA bill can be paid.' };
    if (bill.voucherId) return { error: 'This RA bill is already settled.' };

    // Document gate: block labour vendors without verified EPF/ESI for the month.
    if (bill.vendorId) {
      const month = monthKey(bill.periodTo ?? bill.createdAt);
      const gate = await vendorComplianceStatus(bill.vendorId, month);
      if (gate.blocked) return { error: `Payment blocked — ${gate.reason} Record and verify the challans in Labour Compliance first.` };

      // NCLT gate (#87): a vendor under an IBC moratorium cannot be paid an advance.
      const freeze = await vendorAdvanceFrozen(bill.vendorId);
      if (freeze.blocked) return { error: `Payment blocked — ${freeze.reason} Clear the insolvency flag before settling.` };

      // Structural certification gate (#82): the period must be IE-certified.
      const cert = await structuralCertificationGate(bill.vendorId, month);
      if (cert.blocked) return { error: `Payment blocked — ${cert.reason} Record the engineer certification first.` };
    }

    // MSME status — surfaced, deliberately NOT blocking.
    //
    // The other three gates stop a payment that should not happen. This one is
    // the opposite: an overdue MSME due means you are ALREADY late under s.15
    // of the MSMED Act and risk the expense being disallowed under s.43B(h).
    // Blocking the payment would make that worse, not better. So it is flagged
    // loudly on the way through, and the accounts team is told, so this
    // vendor's other overdue bills get pulled forward.
    let msmeNotice = '';
    if (bill.vendorId) {
      const msme = await vendorMsmeOverdue(bill.vendorId).catch(() => ({ overdue: false, count: 0 }));
      if (msme.overdue) {
        msmeNotice = ` NOTE: this vendor has ${msme.count} MSME payment(s) already past the statutory date — settle those too, or the expense can be disallowed under s.43B(h).`;
      }
    }

    const vendor = bill.vendorId ? await prisma.vendor.findUnique({ where: { id: bill.vendorId }, select: { name: true } }) : null;
    // Atomic counter, not MAX(number). Ordering these as text puts CP-9999
    // above CP-10000, so the series jammed at five digits and two settlements
    // in the same moment collided on the unique index.
    const seq = await nextSequence('voucher:CP', prisma, 1000);

    const voucher = await prisma.voucher.create({
      data: {
        number: `CP-${seq}`, kind: 'BANK_PAID', status: 'POSTED',
        voucherDate: new Date(), partyName: vendor?.name ?? 'Contractor', vendorId: bill.vendorId,
        projectId: bill.projectId, amount: bill.netPayable, mode: 'BANK_TRANSFER',
        reference: bill.number, narration: `Settlement of RA bill ${bill.number}`, accountCode: '5400',
        tdsAmount: bill.tdsAmount, tdsRate: bill.tdsRate, tdsSection: bill.tdsSection,
        retentionAmount: bill.retentionAmount, createdById: ctx.user.id,
      },
    });
    await prisma.raBill.update({ where: { id: billId }, data: { status: 'PAID', voucherId: voucher.id } });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'RaBill', entityId: billId, summary: `Settled ${bill.number} → voucher ${voucher.number} (net ₹${Number(bill.netPayable)})` });
    revalidatePath('/ra-bills');
    return { ok: true, message: `Settled.${msmeNotice}` };
  } catch (err) { return toActionError(err); }
}
