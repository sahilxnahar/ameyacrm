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

export async function runGstrReconcile(): Promise<{ ok: true; result: GstrSweep } | { error: string }> {
  try {
    await ensure('billing.approve');
    const result = await reconcileGstr2b();
    revalidatePath('/gstr-recon');
    return { ok: true, result };
  } catch (err) { return toActionError(err); }
}
