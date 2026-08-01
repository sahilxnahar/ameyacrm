'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from './_helpers';
import { parseTallyFile, type ParsedCompany } from '@/lib/tally/tally-import';

export interface ImportPreview {
  ok: true;
  batchId: string;
  company: string;
  companyExisted: boolean;
  ledgersNew: number;
  ledgersExisting: number;
  vouchersNew: number;
  vouchersDuplicate: number;
  vouchersUnbalanced: number;
  lines: number;
  stockItems: number;
  costCentres: number;
  inventoryLines: number;
  from: string | null;
  to: string | null;
  warnings: string[];
  sample: { date: string; type: string; number: number | null; lines: number; amount: number }[];
}
export type ImportResult = ImportPreview | { error: string };
export type CommitResult = { ok: true; created: number; skipped: number; ledgers: number; stockItems: number; costCentres: number } | { error: string };

const previewSchema = z.object({
  fileName: z.string().min(1).max(255),
  content: z.string().min(1).max(40 * 1024 * 1024), // 40 MB of text
  companyName: z.string().max(160).optional().or(z.literal('')),
});

/**
 * STEP 1 — parse and preview. Nothing is written to the books; we only record a
 * PREVIEW batch so the operator can see exactly what would happen. Importing
 * years of accounts is irreversible in practice, so it is never done blind.
 */
export async function previewTallyImport(input: unknown): Promise<ImportResult> {
  try {
    const ctx = await ensure('admin.setting.manage');
    const d = previewSchema.parse(input);

    const parsed = parseTallyFile(d.content, d.fileName, d.companyName?.trim() || undefined);
    const company = parsed.companies[0];
    if (!company) return { error: parsed.warnings[0] ?? 'Nothing could be read from that file.' };

    const existing = await prisma.tallyCompany.findFirst({
      where: { name: company.name },
      select: { id: true },
    });

    // Which ledgers already exist for this company?
    let ledgersExisting = 0;
    if (existing) {
      const names = company.ledgers.map((l) => l.name);
      if (names.length) {
        ledgersExisting = await prisma.tallyLedger.count({
          where: { companyId: existing.id, name: { in: names } },
        });
      }
    }

    // Which vouchers would be duplicates? (same company + type + number)
    const usable = company.vouchers.filter((v) => v.balanced);
    let vouchersDuplicate = 0;
    if (existing && usable.length) {
      const numbered = usable.filter((v) => v.number !== null);
      if (numbered.length) {
        const found = await prisma.tallyVoucher.findMany({
          where: {
            companyId: existing.id,
            OR: numbered.slice(0, 5000).map((v) => ({ type: v.type, number: v.number as number })),
          },
          select: { id: true },
        });
        vouchersDuplicate = found.length;
      }
    }

    const batch = await prisma.tallyImportBatch.create({
      data: {
        companyId: existing?.id ?? null,
        source: /\.xml$/i.test(d.fileName) ? 'XML' : 'CSV',
        fileName: d.fileName.slice(0, 255),
        status: 'PREVIEW',
        ledgersCreated: Math.max(0, company.ledgers.length - ledgersExisting),
        ledgersUpdated: ledgersExisting,
        vouchersCreated: Math.max(0, usable.length - vouchersDuplicate),
        vouchersSkipped: vouchersDuplicate + (company.vouchers.length - usable.length),
        linesCreated: parsed.totals.lines,
        fromDate: parsed.dateRange.from,
        toDate: parsed.dateRange.to,
        warnings: parsed.warnings.length ? (parsed.warnings as unknown as object) : undefined,
        importedById: ctx.user.id,
      },
      select: { id: true },
    });

    // Stash the parsed payload for the commit step. Kept out of the batch row so
    // a huge file does not bloat the listing query.
    PENDING.set(batch.id, { company, fileName: d.fileName, at: Date.now() });
    prunePending();

    return {
      ok: true,
      batchId: batch.id,
      company: company.name,
      companyExisted: !!existing,
      ledgersNew: Math.max(0, company.ledgers.length - ledgersExisting),
      ledgersExisting,
      vouchersNew: Math.max(0, usable.length - vouchersDuplicate),
      vouchersDuplicate,
      vouchersUnbalanced: company.vouchers.length - usable.length,
      lines: parsed.totals.lines,
      stockItems: parsed.totals.stockItems,
      costCentres: parsed.totals.costCentres,
      inventoryLines: parsed.totals.inventoryLines,
      from: parsed.dateRange.from?.toISOString() ?? null,
      to: parsed.dateRange.to?.toISOString() ?? null,
      warnings: parsed.warnings,
      sample: usable.slice(0, 8).map((v) => ({
        date: v.date.toISOString().slice(0, 10),
        type: v.type,
        number: v.number,
        lines: v.lines.length,
        amount: v.lines.reduce((s, l) => s + l.debit, 0),
      })),
    };
  } catch (err) {
    return toActionError(err);
  }
}

/** In-memory hand-off between preview and commit (single request lifetime). */
const PENDING = new Map<string, { company: ParsedCompany; fileName: string; at: number }>();
function prunePending() {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [k, v] of PENDING) if (v.at < cutoff) PENDING.delete(k);
}

/**
 * STEP 2 — commit a previewed batch into the books.
 *
 * Idempotent by design: ledgers upsert on (company, name) and vouchers are
 * skipped when the same (company, type, number) already exists, so re-running an
 * import — or importing an overlapping period — never double-posts.
 */
export async function commitTallyImport(batchId: string): Promise<CommitResult> {
  try {
    const ctx = await ensure('admin.setting.manage');
    const pending = PENDING.get(batchId);
    if (!pending) {
      return { error: 'That preview has expired. Please upload the file again and re-run the preview.' };
    }
    const batch = await prisma.tallyImportBatch.findUnique({ where: { id: batchId }, select: { id: true, status: true } });
    if (!batch) return { error: 'Import batch not found.' };
    if (batch.status === 'COMMITTED') return { error: 'This batch has already been imported.' };

    const { company } = pending;

    // 1) Company
    const co = await prisma.tallyCompany.upsert({
      where: { name: company.name },
      update: {},
      create: { name: company.name },
      select: { id: true },
    });

    // 2) Ledgers — upsert by (company, name)
    let ledgerCount = 0;
    const ledgerIdByName = new Map<string, string>();
    for (const l of company.ledgers) {
      const row = await prisma.tallyLedger.upsert({
        where: { companyId_name: { companyId: co.id, name: l.name } },
        update: { group: l.group },
        create: {
          companyId: co.id, name: l.name, group: l.group,
          openingBalance: l.openingBalance, openingSide: l.openingSide,
        },
        select: { id: true },
      });
      ledgerIdByName.set(l.name.toLowerCase(), row.id);
      ledgerCount++;
    }

    // 3) Stock items — upsert by (company, name)
    const itemIdByName = new Map<string, string>();
    for (const it of company.stockItems) {
      const row = await prisma.tallyStockItem.upsert({
        where: { companyId_name: { companyId: co.id, name: it.name } },
        update: { unit: it.unit || 'Nos', hsn: it.hsn, gstRate: it.gstRate },
        create: {
          companyId: co.id, name: it.name, unit: it.unit || 'Nos', hsn: it.hsn,
          gstRate: it.gstRate, openingQty: it.openingQty, openingRate: it.openingRate,
        },
        select: { id: true },
      });
      itemIdByName.set(it.name.toLowerCase(), row.id);
    }

    // 4) Cost centres — upsert by (company, name)
    for (const name of company.costCentres) {
      await prisma.tallyCostCentre.upsert({
        where: { companyId_name: { companyId: co.id, name } },
        update: {},
        create: { companyId: co.id, name },
      }).catch(() => undefined);
    }

    // 5) Vouchers — skip duplicates, write each with its lines atomically
    let created = 0;
    let skipped = 0;
    for (const v of company.vouchers) {
      if (!v.balanced) { skipped++; continue; }

      if (v.number !== null) {
        const dupe = await prisma.tallyVoucher.findFirst({
          where: { companyId: co.id, type: v.type, number: v.number },
          select: { id: true },
        });
        if (dupe) { skipped++; continue; }
      }

      const lines = v.lines
        .map((ln) => ({ ledgerId: ledgerIdByName.get(ln.ledgerName.toLowerCase()), debit: ln.debit, credit: ln.credit }))
        .filter((ln): ln is { ledgerId: string; debit: number; credit: number } => !!ln.ledgerId);
      if (lines.length < 2) { skipped++; continue; }

      // A voucher with no number in the source still needs one; take the next
      // free number for that type within this company.
      let number = v.number;
      if (number === null) {
        const max = await prisma.tallyVoucher.aggregate({
          where: { companyId: co.id, type: v.type }, _max: { number: true },
        });
        number = (max._max.number ?? 0) + 1;
      }

      try {
        const invLines = v.inventory
          .map((iv) => {
            const itemId = itemIdByName.get(iv.itemName.toLowerCase());
            return itemId ? { itemId, qty: iv.qty, rate: iv.rate, amount: iv.amount, direction: iv.direction } : null;
          })
          .filter((x): x is { itemId: string; qty: number; rate: number; amount: number; direction: 'IN' | 'OUT' } => x !== null);

        await prisma.tallyVoucher.create({
          data: {
            companyId: co.id, number, type: v.type, date: v.date,
            narration: v.narration, reference: v.reference, costCentre: v.costCentre,
            createdById: ctx.user.id, importBatchId: batchId,
            lines: { create: lines },
            ...(invLines.length ? { inventoryLines: { create: invLines } } : {}),
          },
        });
        created++;
      } catch {
        // Unique clash from a concurrent/duplicate row — count it, keep going.
        skipped++;
      }
    }

    await prisma.tallyImportBatch.update({
      where: { id: batchId },
      data: {
        companyId: co.id, status: 'COMMITTED',
        ledgersCreated: ledgerCount, vouchersCreated: created, vouchersSkipped: skipped,
      },
    });
    PENDING.delete(batchId);

    await writeAudit({
      actorId: ctx.user.id, action: 'CREATE', entityType: 'TallyImportBatch', entityId: batchId,
      summary: `Tally import into "${company.name}": ${created} vouchers, ${ledgerCount} ledgers, ${itemIdByName.size} stock items, ${company.costCentres.length} cost centres (${skipped} skipped)`,
    });

    revalidatePath('/tally');
    revalidatePath('/tally/import');
    return { ok: true, created, skipped, ledgers: ledgerCount, stockItems: itemIdByName.size, costCentres: company.costCentres.length };
  } catch (err) {
    return toActionError(err);
  }
}
