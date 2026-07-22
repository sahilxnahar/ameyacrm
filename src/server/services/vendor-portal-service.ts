import 'server-only';
import { prisma } from '@/lib/db/prisma';

const num = (d: unknown): number => (d == null ? 0 : Number(d));

export interface VendorPortalData {
  vendor: { name: string; gstin: string | null; email: string | null; phone: string | null };
  purchaseOrders: Array<{ number: string; status: string; orderDate: Date; total: number }>;
  bills: Array<{ number: string; status: string; billDate: Date; dueDate: Date | null; amount: number; gstAmount: number }>;
  payments: Array<{ number: string; voucherDate: Date; amount: number; status: string; utr: string | null }>;
  totals: { billed: number; paid: number; outstanding: number };
}

/**
 * Resolve a vendor's portal by its secret token (no login — the same pattern as
 * the customer portal). Read-only: a supplier sees their own orders, bills and
 * payments, and nothing else. Returns null for an unknown/expired token.
 */
export async function getVendorPortal(token: string): Promise<VendorPortalData | null> {
  const access = await prisma.vendorPortalAccess.findUnique({ where: { token } });
  if (!access) return null;
  const vendor = await prisma.vendor.findUnique({ where: { id: access.vendorId }, select: { name: true, gstin: true, email: true, phone: true } });
  if (!vendor) return null;

  const [pos, bills, vouchers] = await Promise.all([
    prisma.purchaseOrder.findMany({ where: { vendorId: access.vendorId }, orderBy: { orderDate: 'desc' }, take: 200, select: { number: true, status: true, orderDate: true, total: true } }),
    prisma.vendorBill.findMany({ where: { vendorId: access.vendorId }, orderBy: { billDate: 'desc' }, take: 200, select: { number: true, status: true, billDate: true, dueDate: true, amount: true, gstAmount: true } }),
    prisma.voucher.findMany({ where: { vendorId: access.vendorId, cancelledAt: null }, orderBy: { voucherDate: 'desc' }, take: 200, select: { number: true, voucherDate: true, amount: true, status: true, utr: true } }),
  ]);

  const billed = bills.reduce((s, b) => s + num(b.amount) + num(b.gstAmount), 0);
  const paid = vouchers.reduce((s, v) => s + num(v.amount), 0);

  return {
    vendor,
    purchaseOrders: pos.map((p) => ({ number: p.number, status: p.status, orderDate: p.orderDate, total: num(p.total) })),
    bills: bills.map((b) => ({ number: b.number, status: b.status, billDate: b.billDate, dueDate: b.dueDate, amount: num(b.amount), gstAmount: num(b.gstAmount) })),
    payments: vouchers.map((v) => ({ number: v.number, voucherDate: v.voucherDate, amount: num(v.amount), status: v.status, utr: v.utr })),
    totals: { billed, paid, outstanding: Math.max(0, billed - paid) },
  };
}
