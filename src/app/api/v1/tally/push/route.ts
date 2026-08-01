import { NextResponse, type NextRequest } from 'next/server';
import { requireHeaderSecret } from '@/lib/security/require-secret';
import { env } from '@/config/env';
import { prisma } from '@/lib/db/prisma';
import { limitOr429 } from '@/lib/security/rate-limit';
import { parseTallyXml } from '@/lib/tally/tally-import';
import { logError } from '@/lib/monitoring/log-error';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Live-sync endpoint for the Ameya Tally Bridge (see tools/tally-bridge/).
 *
 * Direction of travel matters for security: Tally is NEVER exposed to the
 * internet. The bridge agent runs on the machine that has Tally, reads from
 * Tally's local XML gateway (127.0.0.1:9000) and PUSHES here over HTTPS. So this
 * is an ordinary outbound-only integration — no inbound firewall holes, no port
 * forwarding, nothing listening on the office network.
 *
 * Auth is the same fail-closed shared-secret pattern as the other machine
 * endpoints: header-only (never a query string), constant-time compare, and a
 * 503 when TALLY_BRIDGE_SECRET is unset so the endpoint is OFF by default.
 */
export async function POST(req: NextRequest) {
  const denied = requireHeaderSecret(req, 'x-tally-bridge-key', env.TALLY_BRIDGE_SECRET);
  if (denied) return denied;

  const limited = await limitOr429('tally-bridge', 60, 60);
  if (limited) return limited;

  let body: { company?: string; xml?: string };
  try {
    body = (await req.json()) as { company?: string; xml?: string };
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const xml = String(body.xml ?? '');
  if (!xml || xml.length > 40 * 1024 * 1024) {
    return NextResponse.json({ error: 'xml is required (max 40 MB per push)' }, { status: 400 });
  }

  try {
    const parsed = parseTallyXml(xml, body.company?.trim() || undefined);
    const company = parsed.companies[0];
    if (!company) return NextResponse.json({ error: 'nothing readable in payload', warnings: parsed.warnings }, { status: 400 });

    const co = await prisma.tallyCompany.upsert({
      where: { name: company.name },
      update: {},
      create: { name: company.name },
      select: { id: true },
    });

    const batch = await prisma.tallyImportBatch.create({
      data: {
        companyId: co.id, source: 'BRIDGE', fileName: 'live-sync', status: 'PREVIEW',
        fromDate: parsed.dateRange.from, toDate: parsed.dateRange.to,
        warnings: parsed.warnings.length ? (parsed.warnings as unknown as object) : undefined,
      },
      select: { id: true },
    });

    // Ledgers
    const ledgerIdByName = new Map<string, string>();
    for (const l of company.ledgers) {
      const row = await prisma.tallyLedger.upsert({
        where: { companyId_name: { companyId: co.id, name: l.name } },
        update: { group: l.group },
        create: { companyId: co.id, name: l.name, group: l.group, openingBalance: l.openingBalance, openingSide: l.openingSide },
        select: { id: true },
      });
      ledgerIdByName.set(l.name.toLowerCase(), row.id);
    }

    // Stock items
    const itemIdByName = new Map<string, string>();
    for (const it of company.stockItems) {
      const row = await prisma.tallyStockItem.upsert({
        where: { companyId_name: { companyId: co.id, name: it.name } },
        update: { unit: it.unit || 'Nos', hsn: it.hsn, gstRate: it.gstRate },
        create: { companyId: co.id, name: it.name, unit: it.unit || 'Nos', hsn: it.hsn, gstRate: it.gstRate, openingQty: it.openingQty, openingRate: it.openingRate },
        select: { id: true },
      });
      itemIdByName.set(it.name.toLowerCase(), row.id);
    }

    // Cost centres
    for (const name of company.costCentres) {
      await prisma.tallyCostCentre.upsert({
        where: { companyId_name: { companyId: co.id, name } },
        update: {}, create: { companyId: co.id, name },
      }).catch(() => undefined);
    }

    // Vouchers — idempotent: an already-synced (type, number) is skipped, so the
    // bridge can safely re-send an overlapping window on every run.
    let created = 0;
    let skipped = 0;
    for (const v of company.vouchers) {
      if (!v.balanced || v.number === null) { skipped++; continue; }
      const dupe = await prisma.tallyVoucher.findFirst({
        where: { companyId: co.id, type: v.type, number: v.number }, select: { id: true },
      });
      if (dupe) { skipped++; continue; }

      const lines = v.lines
        .map((ln) => ({ ledgerId: ledgerIdByName.get(ln.ledgerName.toLowerCase()), debit: ln.debit, credit: ln.credit }))
        .filter((ln): ln is { ledgerId: string; debit: number; credit: number } => !!ln.ledgerId);
      if (lines.length < 2) { skipped++; continue; }

      const invLines = v.inventory
        .map((iv) => {
          const itemId = itemIdByName.get(iv.itemName.toLowerCase());
          return itemId ? { itemId, qty: iv.qty, rate: iv.rate, amount: iv.amount, direction: iv.direction } : null;
        })
        .filter((x): x is { itemId: string; qty: number; rate: number; amount: number; direction: 'IN' | 'OUT' } => x !== null);

      try {
        await prisma.tallyVoucher.create({
          data: {
            companyId: co.id, number: v.number, type: v.type, date: v.date,
            narration: v.narration, reference: v.reference, costCentre: v.costCentre,
            importBatchId: batch.id,
            lines: { create: lines },
            ...(invLines.length ? { inventoryLines: { create: invLines } } : {}),
          },
        });
        created++;
      } catch { skipped++; }
    }

    await prisma.tallyImportBatch.update({
      where: { id: batch.id },
      data: {
        status: 'COMMITTED', ledgersCreated: ledgerIdByName.size,
        vouchersCreated: created, vouchersSkipped: skipped, linesCreated: parsed.totals.lines,
      },
    });

    return NextResponse.json({
      ok: true, company: company.name, batchId: batch.id,
      ledgers: ledgerIdByName.size, stockItems: itemIdByName.size,
      costCentres: company.costCentres.length, vouchersCreated: created, vouchersSkipped: skipped,
      warnings: parsed.warnings,
    });
  } catch (e) {
    await logError(e, { path: '/api/v1/tally/push' });
    return NextResponse.json({ error: 'sync failed' }, { status: 500 });
  }
}
