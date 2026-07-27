'use server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { parseUanBlock, isValidUanFormat, normaliseUan } from '@/lib/labour/uan';
import { ensure, toActionError } from './_helpers';

/**
 * Bulk-import a pasted block of contractor UANs and format-validate each in one
 * pass. Idempotent on the UAN (upsert), so re-pasting the same roster updates
 * rather than duplicates. A live GSP confirmation can be layered on later; the
 * format gate already blocks the obviously-invalid at the checkpoint.
 */
export async function bulkImportUans(text: string, vendorId?: string | null): Promise<{ ok: true; imported: number; invalid: number } | { error: string }> {
  try {
    await ensure('procurement.manage');
    const rows = parseUanBlock(text);
    if (!rows.length) return { error: 'No UANs found in the pasted text.' };
    let imported = 0, invalid = 0;
    for (const r of rows) {
      if (!r.uan) continue;
      const status = r.validFormat ? 'VALID' : 'INVALID';
      if (!r.validFormat) invalid++;
      await prisma.labourUan.upsert({
        where: { uan: r.uan || `bad-${imported}-${invalid}` },
        update: { workerName: r.workerName, status, vendorId: vendorId || null, verifiedAt: r.validFormat ? new Date() : null },
        create: { uan: r.uan, workerName: r.workerName, status, vendorId: vendorId || null, verifiedAt: r.validFormat ? new Date() : null },
      }).catch(() => undefined);
      imported++;
    }
    await writeAudit({ action: 'CREATE', entityType: 'LabourUan', entityId: vendorId ?? 'bulk', summary: `UAN bulk import: ${imported} rows, ${invalid} invalid` });
    revalidatePath('/uan-validator');
    return { ok: true, imported, invalid };
  } catch (err) { return toActionError(err); }
}

export async function addUan(workerName: string, uan: string, vendorId?: string | null): Promise<{ ok: true } | { error: string }> {
  try {
    await ensure('procurement.manage');
    const clean = normaliseUan(uan);
    if (!workerName?.trim() || !clean) return { error: 'Worker name and UAN are required.' };
    const valid = isValidUanFormat(clean);
    await prisma.labourUan.upsert({
      where: { uan: clean },
      update: { workerName: workerName.trim(), status: valid ? 'VALID' : 'INVALID', vendorId: vendorId || null, verifiedAt: valid ? new Date() : null },
      create: { uan: clean, workerName: workerName.trim(), status: valid ? 'VALID' : 'INVALID', vendorId: vendorId || null, verifiedAt: valid ? new Date() : null },
    });
    revalidatePath('/uan-validator');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}
