import 'server-only';
import { prisma } from '@/lib/db/prisma';

/**
 * GSTR-2A/2B reconciliation (module #52). Matches supplier lines pulled from the
 * GST portal (2B) against our VendorBills before Input Tax Credit is claimed and
 * before the bill is cleared. Non-stop safe: every read/write is caught, so an
 * un-migrated table or a bad row never stalls the sweep. Idempotent — only
 * touches UNMATCHED rows, so it can re-run every day without side effects.
 */
export interface GstrSweep { scanned: number; matched: number; mismatched: number; missing: number }

export async function reconcileGstr2b(): Promise<GstrSweep> {
  let scanned = 0, matched = 0, mismatched = 0, missing = 0;
  try {
    const lines = await prisma.gstr2bLine.findMany({ where: { status: 'UNMATCHED' }, take: 1000 });
    scanned = lines.length;
    for (const l of lines) {
      try {
        // Match by invoice number to a VendorBill; compare the total value.
        const bill = await prisma.vendorBill.findFirst({ where: { number: l.invoiceNo }, select: { id: true, amount: true, gstAmount: true } });
        if (!bill) {
          await prisma.gstr2bLine.update({ where: { id: l.id }, data: { status: 'MISSING_IN_BOOKS' } });
          missing++;
          continue;
        }
        const lineTotal = Number(l.taxableValue) + Number(l.igst) + Number(l.cgst) + Number(l.sgst);
        const billTotal = Number(bill.amount) + Number(bill.gstAmount);
        const withinTolerance = Math.abs(lineTotal - billTotal) <= 1; // ₹1 rounding tolerance
        await prisma.gstr2bLine.update({ where: { id: l.id }, data: { vendorBillId: bill.id, status: withinTolerance ? 'MATCHED' : 'MISMATCH_AMOUNT' } });
        if (withinTolerance) matched++; else mismatched++;
      } catch { /* per-line isolation — one bad row skips only itself */ }
    }
  } catch { /* table not migrated — skip */ }
  return { scanned, matched, mismatched, missing };
}

export async function getGstrSummary(): Promise<{ matched: number; unmatched: number; mismatch: number; missing: number }> {
  const [matched, unmatched, mismatch, missing] = await Promise.all([
    prisma.gstr2bLine.count({ where: { status: 'MATCHED' } }).catch(() => 0),
    prisma.gstr2bLine.count({ where: { status: 'UNMATCHED' } }).catch(() => 0),
    prisma.gstr2bLine.count({ where: { status: 'MISMATCH_AMOUNT' } }).catch(() => 0),
    prisma.gstr2bLine.count({ where: { status: { in: ['MISSING_IN_2B', 'MISSING_IN_BOOKS'] } } }).catch(() => 0),
  ]);
  return { matched, unmatched, mismatch, missing };
}
