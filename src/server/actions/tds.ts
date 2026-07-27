'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { TDS_SECTION_CODES } from '@/config/tds-sections';
import { ensure, toActionError } from './_helpers';

export interface TdsEntry {
  id: string;
  number: string;
  date: string;
  party: string;
  vendorId: string | null;
  section: string | null;
  base: number;          // payment amount
  rate: number | null;
  tds: number;
  deposited: boolean;
  challanNo: string | null;
  depositedAt: string | null;
  bankName: string | null;
}

function num(x: unknown): number { return Number(x ?? 0); }

function toEntry(v: {
  id: string; number: string; voucherDate: Date; partyName: string; vendorId: string | null;
  tdsSection: string | null; amount: unknown; tdsRate: unknown; tdsAmount: unknown;
  tdsChallanNo: string | null; tdsDepositedAt: Date | null; bankName: string | null;
}): TdsEntry {
  return {
    id: v.id, number: v.number, date: v.voucherDate.toISOString(), party: v.partyName, vendorId: v.vendorId,
    section: v.tdsSection, base: num(v.amount), rate: v.tdsRate == null ? null : num(v.tdsRate),
    tds: num(v.tdsAmount), deposited: !!v.tdsDepositedAt, challanNo: v.tdsChallanNo,
    depositedAt: v.tdsDepositedAt ? v.tdsDepositedAt.toISOString() : null, bankName: v.bankName,
  };
}

const SELECT = {
  id: true, number: true, voucherDate: true, partyName: true, vendorId: true, tdsSection: true,
  amount: true, tdsRate: true, tdsAmount: true, tdsChallanNo: true, tdsDepositedAt: true, bankName: true,
} as const;

/** Overall TDS position for the dashboard: accrued, deposited, pending + section split + recent entries. */
export async function tdsDashboard(): Promise<{
  accrued: number; deposited: number; pending: number; count: number; pendingCount: number;
  bySection: Array<{ section: string; tds: number; count: number }>;
  recent: TdsEntry[];
} | { error: string }> {
  try {
    await ensure('finance.ledger.view');
    const rows = await prisma.voucher.findMany({
      where: { tdsAmount: { gt: 0 }, cancelledAt: null },
      orderBy: { voucherDate: 'desc' }, take: 1000, select: SELECT,
    });
    let accrued = 0, deposited = 0, pendingCount = 0;
    const secMap = new Map<string, { tds: number; count: number }>();
    for (const v of rows) {
      const t = num(v.tdsAmount); accrued += t;
      if (v.tdsDepositedAt) deposited += t; else pendingCount++;
      const key = v.tdsSection || 'Unmapped';
      const e = secMap.get(key) ?? { tds: 0, count: 0 }; e.tds += t; e.count++; secMap.set(key, e);
    }
    return {
      accrued: Math.round(accrued), deposited: Math.round(deposited), pending: Math.round(accrued - deposited),
      count: rows.length, pendingCount,
      bySection: [...secMap.entries()].map(([section, v]) => ({ section, tds: Math.round(v.tds), count: v.count })).sort((a, b) => b.tds - a.tds),
      recent: rows.slice(0, 50).map(toEntry),
    };
  } catch (err) { return toActionError(err); }
}

/**
 * Bank-account / vendor lookup → the full TDS ledger tied to it. Matches on
 * vendor name, bank name, IFSC (all indexable) and, because account numbers are
 * encrypted at rest, on the decrypted account number in-app (last-4 friendly).
 */
export async function tdsLookup(query: string): Promise<{ ok: true; entries: TdsEntry[]; totals: { accrued: number; deposited: number; pending: number } } | { error: string }> {
  try {
    await ensure('finance.ledger.view');
    const q = z.string().min(1).max(80).parse(query).trim();

    // 1) vendors matching on unencrypted fields, plus decrypted account-number match.
    const candidates = await prisma.vendor.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { bankName: { contains: q, mode: 'insensitive' } },
          { bankIfsc: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
      take: 200,
    });
    const digits = q.replace(/\D/g, '');
    let vendorIds = candidates.map((c) => c.id);
    if (digits.length >= 4) {
      // account numbers come back decrypted via the Prisma layer; match last digits.
      const withAcct = await prisma.vendor.findMany({ where: { bankAccountNumber: { not: null } }, select: { id: true, bankAccountNumber: true }, take: 1000 });
      for (const v of withAcct) {
        const acct = (v.bankAccountNumber ?? '').replace(/\D/g, '');
        if (acct && acct.includes(digits)) vendorIds.push(v.id);
      }
    }
    vendorIds = [...new Set(vendorIds)];

    // 2) all TDS vouchers for those vendors, OR matching the party/bank text directly.
    const rows = await prisma.voucher.findMany({
      where: {
        tdsAmount: { gt: 0 }, cancelledAt: null,
        OR: [
          ...(vendorIds.length ? [{ vendorId: { in: vendorIds } }] : []),
          { partyName: { contains: q, mode: 'insensitive' } },
          { bankName: { contains: q, mode: 'insensitive' } },
        ],
      },
      orderBy: { voucherDate: 'desc' }, take: 500, select: SELECT,
    });
    const entries = rows.map(toEntry);
    const accrued = entries.reduce((s, e) => s + e.tds, 0);
    const deposited = entries.filter((e) => e.deposited).reduce((s, e) => s + e.tds, 0);
    return { ok: true, entries, totals: { accrued: Math.round(accrued), deposited: Math.round(deposited), pending: Math.round(accrued - deposited) } };
  } catch (err) { return toActionError(err); }
}

const depositSchema = z.object({
  voucherIds: z.array(z.string().min(1)).min(1).max(500),
  challanNo: z.string().min(1).max(60),
  depositedOn: z.string().optional(),
});

/** Mark the TDS on one or more vouchers as deposited to the government. */
export async function depositTds(input: unknown): Promise<{ ok: true; updated: number } | { error: string }> {
  try {
    const ctx = await ensure('finance.ledger.manage');
    const d = depositSchema.parse(input);
    const when = d.depositedOn ? new Date(d.depositedOn) : new Date();
    const res = await prisma.voucher.updateMany({
      where: { id: { in: d.voucherIds }, tdsAmount: { gt: 0 } },
      data: { tdsDepositedAt: when, tdsChallanNo: d.challanNo },
    });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'Voucher', summary: `Marked TDS deposited on ${res.count} payment(s), challan ${d.challanNo}` });
    revalidatePath('/tds');
    return { ok: true, updated: res.count };
  } catch (err) { return toActionError(err); }
}

/** Save a vendor's default TDS section so future payments auto-map. */
export async function setVendorTdsSection(vendorId: string, section: string | null): Promise<{ ok: true } | { error: string }> {
  try {
    const ctx = await ensure('finance.ledger.manage');
    const id = z.string().min(1).parse(vendorId);
    const sec = section && TDS_SECTION_CODES.includes(section) ? section : null;
    await prisma.vendor.update({ where: { id }, data: { defaultTdsSection: sec } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'Vendor', entityId: id, summary: sec ? `Set default TDS section ${sec}` : 'Cleared default TDS section' });
    revalidatePath('/tds');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}
