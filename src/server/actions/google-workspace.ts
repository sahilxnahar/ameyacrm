'use server';
import { ensure, toActionError } from './_helpers';
import { prisma } from '@/lib/db/prisma';
import { gasSheet } from '@/lib/google/appscript';
import { writeAudit } from '@/lib/audit/log';

export type Dataset = 'leads' | 'vendors' | 'bookings';
export type SheetExportResult = { ok: true; rows: number; tab: string } | { error: string };

const money = (d: unknown): number | string => (d == null ? '' : Number(d));
const day = (d: Date | null | undefined): string => (d ? d.toISOString().slice(0, 10) : '');

/**
 * Push a CRM list into a tab of your linked Google Sheet, via the Apps Script
 * connector (no Google Cloud Console). Overwrites that tab with the current data.
 */
export async function exportToSheet(dataset: Dataset): Promise<SheetExportResult> {
  try {
    let tab = '';
    let header: string[] = [];
    let rows: (string | number)[][] = [];
    let actorId = '';

    if (dataset === 'leads') {
      const ctx = await ensure('lead.view');
      actorId = ctx.user.id;
      const items = await prisma.lead.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 5000,
        select: { reference: true, name: true, phone: true, email: true, status: true, temperature: true, score: true, locality: true, createdAt: true },
      });
      tab = 'Leads';
      header = ['Reference', 'Name', 'Phone', 'Email', 'Status', 'Temperature', 'Score', 'Locality', 'Created'];
      rows = items.map((l) => [l.reference, l.name, l.phone ?? '', l.email ?? '', String(l.status), String(l.temperature), l.score, l.locality ?? '', day(l.createdAt)]);
    } else if (dataset === 'vendors') {
      const ctx = await ensure('billing.view');
      actorId = ctx.user.id;
      const items = await prisma.vendor.findMany({
        orderBy: { name: 'asc' },
        take: 5000,
        select: { name: true, gstin: true, phone: true, email: true, bankName: true, bankAccountNumber: true, bankIfsc: true, isActive: true },
      });
      tab = 'Vendors';
      header = ['Name', 'GSTIN', 'Phone', 'Email', 'Bank', 'Account No.', 'IFSC', 'Active'];
      rows = items.map((v) => [v.name, v.gstin ?? '', v.phone ?? '', v.email ?? '', v.bankName ?? '', v.bankAccountNumber ?? '', v.bankIfsc ?? '', v.isActive ? 'Yes' : 'No']);
    } else {
      const ctx = await ensure('booking.view');
      actorId = ctx.user.id;
      const items = await prisma.booking.findMany({
        orderBy: { bookedAt: 'desc' },
        take: 5000,
        select: { reference: true, agreementValue: true, bookedAt: true, lead: { select: { name: true } } },
      });
      tab = 'Bookings';
      header = ['Reference', 'Buyer', 'Agreement value', 'Booked on'];
      rows = items.map((b) => [b.reference, b.lead?.name ?? '', money(b.agreementValue), day(b.bookedAt)]);
    }

    const r = await gasSheet(tab, header, rows);
    if ('error' in r) return { error: r.error };
    await writeAudit({ actorId, action: 'EXPORT', entityType: 'GoogleSheet', summary: `Exported ${rows.length} ${dataset} to the "${tab}" tab` });
    return { ok: true, rows: r.rows, tab };
  } catch (e) {
    return toActionError(e);
  }
}
