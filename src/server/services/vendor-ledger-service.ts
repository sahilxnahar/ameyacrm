import 'server-only';
import { prisma } from '@/lib/db/prisma';

const num = (d: unknown): number => (d == null ? 0 : Number(d));
const PAID_KINDS = ['CASH_PAID', 'BANK_PAID'] as const;

export interface LedgerRow { id: string; name: string; gstin: string | null; hasBank: boolean; totalPaid: number; count: number; owed: number }

/**
 * One ledger per payee (vendor). The total is every payment we've made to them —
 * vouchers linked by vendorId, plus any still only tagged by the same name — so
 * imported data and older free-text vouchers both roll up.
 */
export async function listLedgers(): Promise<LedgerRow[]> {
  const vendors = await prisma.vendor.findMany({
    where: { isActive: true }, orderBy: { name: 'asc' }, take: 2000,
    select: { id: true, name: true, gstin: true, bankAccountNumber: true, upiId: true },
  });
  const [byVendor, byParty, unpaidBills] = await Promise.all([
    prisma.voucher.groupBy({ by: ['vendorId'], where: { kind: { in: [...PAID_KINDS] }, cancelledAt: null, vendorId: { not: null } }, _sum: { amount: true }, _count: { _all: true } }),
    prisma.voucher.groupBy({ by: ['partyName'], where: { kind: { in: [...PAID_KINDS] }, cancelledAt: null, vendorId: null }, _sum: { amount: true }, _count: { _all: true } }),
    // What we still owe: vendor bills not yet fully paid (anything but PAID/VOID).
    prisma.vendorBill.groupBy({ by: ['vendorId'], where: { vendorId: { not: null }, status: { notIn: ['PAID', 'VOID'] } }, _sum: { amount: true, gstAmount: true } }),
  ]);
  const vMap = new Map(byVendor.map((r) => [r.vendorId!, { sum: num(r._sum.amount), count: r._count._all }]));
  const pMap = new Map(byParty.map((r) => [(r.partyName ?? '').trim().toLowerCase(), { sum: num(r._sum.amount), count: r._count._all }]));
  const owedMap = new Map(unpaidBills.map((r) => [r.vendorId!, num(r._sum.amount) + num(r._sum.gstAmount)]));

  return vendors.map((v) => {
    const a = vMap.get(v.id) ?? { sum: 0, count: 0 };
    const b = pMap.get(v.name.trim().toLowerCase()) ?? { sum: 0, count: 0 };
    return { id: v.id, name: v.name, gstin: v.gstin, hasBank: Boolean(v.bankAccountNumber || v.upiId), totalPaid: a.sum + b.sum, count: a.count + b.count, owed: owedMap.get(v.id) ?? 0 };
  }).sort((a, b) => b.totalPaid - a.totalPaid);
}

export interface LedgerDetail {
  vendor: { id: string; name: string; gstin: string | null; phone: string | null; bankName: string | null; bankAccountName: string | null; bankAccountNumber: string | null; bankIfsc: string | null; upiId: string | null };
  totalPaid: number;
  payments: Array<{ id: string; number: string; date: Date; paidOn: Date | null; amount: number; mode: string; reference: string | null; utr: string | null; narration: string | null; proofUrl: string | null; category: string | null }>;
}

export async function getLedger(vendorId: string): Promise<LedgerDetail | null> {
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor) return null;
  const vouchers = await prisma.voucher.findMany({
    where: {
      kind: { in: [...PAID_KINDS] }, cancelledAt: null,
      OR: [{ vendorId }, { vendorId: null, partyName: { equals: vendor.name, mode: 'insensitive' } }],
    },
    orderBy: { voucherDate: 'desc' }, take: 1000,
    // `attachmentId` carries the proof-of-payment file URL (screenshot / bank PDF).
    select: { id: true, number: true, voucherDate: true, paidOn: true, amount: true, mode: true, reference: true, utr: true, narration: true, attachmentId: true, accountCode: true },
  });
  return {
    vendor: {
      id: vendor.id, name: vendor.name, gstin: vendor.gstin, phone: vendor.phone,
      bankName: vendor.bankName, bankAccountName: vendor.bankAccountName, bankAccountNumber: vendor.bankAccountNumber, bankIfsc: vendor.bankIfsc, upiId: vendor.upiId,
    },
    totalPaid: vouchers.reduce((s, v) => s + num(v.amount), 0),
    payments: vouchers.map((v) => ({ id: v.id, number: v.number, date: v.voucherDate, paidOn: v.paidOn, amount: num(v.amount), mode: v.mode, reference: v.reference, utr: v.utr, narration: v.narration, proofUrl: v.attachmentId, category: v.accountCode })),
  };
}
