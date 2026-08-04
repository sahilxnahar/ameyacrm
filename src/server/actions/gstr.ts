'use server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { parseGstrCsv } from '@/lib/import/parse-gstr';
import { reconcileGstr2b, type GstrSweep } from '@/server/services/gstr-service';
import { ensure, toActionError } from './_helpers';

/** Import a GSTR-2B export (CSV text from the uploaded sheet) for a period. */
export async function importGstr2b(csv: string, period: string): Promise<{ ok: true; imported: number } | { error: string }> {
  try {
    await ensure('billing.approve');
    if (!/^\d{4}-\d{2}$/.test(period)) return { error: 'Period must be YYYY-MM.' };
    const rows = parseGstrCsv(csv);
    if (!rows.length) return { error: 'No usable rows found. Expected columns: Supplier GSTIN, Invoice No, Taxable Value, IGST, CGST, SGST.' };
    let imported = 0;
    for (const r of rows) {
      const gstin = r.supplierGstin || 'UNKNOWN';
      await prisma.gstr2bLine.upsert({
        where: { supplierGstin_invoiceNo_period: { supplierGstin: gstin, invoiceNo: r.invoiceNo, period } },
        update: { taxableValue: r.taxableValue, igst: r.igst, cgst: r.cgst, sgst: r.sgst, status: 'UNMATCHED' },
        create: { period, supplierGstin: gstin, invoiceNo: r.invoiceNo, invoiceDate: r.invoiceDate ? new Date(r.invoiceDate) : null, taxableValue: r.taxableValue, igst: r.igst, cgst: r.cgst, sgst: r.sgst },
      }).catch(() => undefined);
      imported++;
    }
    await writeAudit({ action: 'CREATE', entityType: 'Gstr2bLine', entityId: period, summary: `GSTR-2B import ${period}: ${imported} lines` });
    // Auto-reconcile straight after import so the screen shows matches immediately.
    await reconcileGstr2b();
    revalidatePath('/gstr-recon');
    return { ok: true, imported };
  } catch (err) { return toActionError(err); }
}

/**
 * Add one GSTR-2B line by hand.
 *
 * The screen was upload-only. That is right for a monthly 2B with four hundred
 * rows, and wrong for the case that actually comes up between filings: two
 * invoices you want to check now. Making somebody build a CSV to reconcile two
 * lines is how a reconciliation screen stops being used at all.
 *
 * It writes through the same upsert as the import, on the same unique key, so a
 * line typed today is overwritten by the real 2B when it is uploaded — the
 * portal's figures always win over anything typed by hand, which is the correct
 * precedence for a government return.
 */
export async function addGstr2bLine(input: {
  period: string;
  supplierGstin: string;
  invoiceNo: string;
  invoiceDate?: string | null;
  taxableValue: number;
  igst?: number;
  cgst?: number;
  sgst?: number;
}): Promise<{ ok: true; invoiceNo: string } | { error: string }> {
  try {
    await ensure('billing.approve');
    if (!/^\d{4}-\d{2}$/.test(input.period)) return { error: 'Period must be YYYY-MM.' };
    const invoiceNo = (input.invoiceNo ?? '').trim();
    if (!invoiceNo) return { error: 'The invoice number is required.' };

    const gstin = (input.supplierGstin ?? '').trim().toUpperCase() || 'UNKNOWN';
    // Checked, not enforced: a supplier really can appear on the 2B with a GSTIN
    // that fails the checksum, and refusing to record it would hide the problem
    // rather than surface it.
    const gstinLooksRight = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]{3}$/.test(gstin);

    const n = (v?: number) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
    if (n(input.taxableValue) <= 0) return { error: 'Enter the taxable value.' };

    await prisma.gstr2bLine.upsert({
      where: { supplierGstin_invoiceNo_period: { supplierGstin: gstin, invoiceNo, period: input.period } },
      update: {
        taxableValue: n(input.taxableValue), igst: n(input.igst), cgst: n(input.cgst), sgst: n(input.sgst),
        invoiceDate: input.invoiceDate ? new Date(input.invoiceDate) : null, status: 'UNMATCHED',
      },
      create: {
        period: input.period, supplierGstin: gstin, invoiceNo,
        invoiceDate: input.invoiceDate ? new Date(input.invoiceDate) : null,
        taxableValue: n(input.taxableValue), igst: n(input.igst), cgst: n(input.cgst), sgst: n(input.sgst),
      },
    });
    await writeAudit({
      action: 'CREATE', entityType: 'Gstr2bLine', entityId: `${input.period}:${invoiceNo}`,
      summary: `GSTR-2B line entered by hand — ${gstin} ${invoiceNo} (${input.period})`,
    });
    await reconcileGstr2b();
    revalidatePath('/gstr-recon');
    return {
      ok: true,
      invoiceNo: gstinLooksRight ? invoiceNo : `${invoiceNo} (that GSTIN does not look valid — recorded anyway)`,
    };
  } catch (err) { return toActionError(err); }
}

export async function runGstrReconcile(): Promise<{ ok: true; result: GstrSweep } | { error: string }> {
  try {
    await ensure('billing.approve');
    const result = await reconcileGstr2b();
    revalidatePath('/gstr-recon');
    return { ok: true, result };
  } catch (err) { return toActionError(err); }
}
