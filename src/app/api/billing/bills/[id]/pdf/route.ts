import { NextResponse, type NextRequest } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { prisma } from '@/lib/db/prisma';
import { getCurrentUser } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { brand } from '@/config/brand';
import { drawLetterhead } from '@/lib/pdf/letterhead';
import { EMBLEM_PNG_BASE64 } from '@/lib/pdf/brand-marks';
import { getCompanyDetails } from '@/server/services/company-service';
import { writeAudit } from '@/lib/audit/log';

/**
 * A printable copy of a supplier bill as it stands in the CRM.
 *
 * Not a re-creation of the supplier's own invoice — that is attached to the
 * record and can be opened directly. This is the internal sheet: what was
 * recorded, what it was for, whether it has been paid, and against which
 * voucher. It is what gets stapled to a payment file or handed to an auditor
 * who asks "show me what you approved and what you paid".
 */
const CHARCOAL = rgb(0.08, 0.07, 0.05);
const MUTED = rgb(0.37, 0.35, 0.30);
const GOLD = rgb(0.63, 0.49, 0.20);

const inr = (n: number) => `Rs ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const ascii = (s: string) => (s ?? '').replace(/[^\x20-\x7E]/g, (c) => ({ '—': '-', '–': '-', '‘': "'", '’': "'", '“': '"', '”': '"', '₹': 'Rs' }[c] ?? ''));

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getCurrentUser();
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!can(ctx.permissions, 'billing.view')) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { id } = await params;
  const bill = await prisma.vendorBill.findUnique({
    where: { id },
    select: {
      id: true, number: true, amount: true, gstAmount: true, status: true,
      billDate: true, dueDate: true, notes: true, attachmentName: true,
      vendor: { select: { name: true, gstin: true, pan: true, address: true, phone: true, email: true } },
    },
  }).catch(() => null);
  if (!bill) return NextResponse.json({ error: 'not found' }, { status: 404 });

  // The payment, if one has been raised against this bill.
  const voucher = await prisma.voucher.findFirst({
    where: { vendorBillId: id, status: { not: 'CANCELLED' } },
    select: { number: true, voucherDate: true, amount: true, mode: true, utr: true, status: true },
    orderBy: { createdAt: 'desc' },
  }).catch(() => null);

  const co = await getCompanyDetails();
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const emblem = await doc.embedPng(Buffer.from(EMBLEM_PNG_BASE64, 'base64'));
  const W = 595.28, M = 48;

  const { headerBottom } = drawLetterhead(page, { font, bold }, {
    legalName: co.legalName || brand.company.displayName,
    registeredAddress: co.registeredAddress,
    phone: co.phone, email: co.email, website: co.website || brand.company.website,
    gstin: co.gstin,
  }, { compact: true, emblem });

  const text = (s: string, x: number, y: number, size = 10, f = font, color = CHARCOAL) =>
    page.drawText(ascii(s), { x, y, size, font: f, color });
  const right = (s: string, xr: number, y: number, size = 10, f = font, color = CHARCOAL) =>
    page.drawText(ascii(s), { x: xr - f.widthOfTextAtSize(ascii(s), size), y, size, font: f, color });

  let y = headerBottom - 26;
  text('SUPPLIER BILL', M, y, 15, bold);
  right(bill.number, W - M, y, 13, bold, GOLD);
  y -= 8;
  page.drawRectangle({ x: M, y, width: W - 2 * M, height: 1.2, color: GOLD });
  y -= 24;

  const gross = Number(bill.amount) + Number(bill.gstAmount ?? 0);
  const rows: Array<[string, string]> = [
    ['Supplier', bill.vendor?.name ?? '—'],
    ...(bill.vendor?.gstin ? [['Supplier GSTIN', bill.vendor.gstin] as [string, string]] : []),
    ...(bill.vendor?.pan ? [['Supplier PAN', bill.vendor.pan] as [string, string]] : []),
    ['Bill date', bill.billDate ? bill.billDate.toLocaleDateString('en-IN') : '—'],
    ['Due date', bill.dueDate ? bill.dueDate.toLocaleDateString('en-IN') : 'Not set'],
    ['Status', bill.status],
    ...(bill.notes ? [['What it is for', bill.notes] as [string, string]] : []),
    ...(bill.attachmentName ? [["Supplier's own bill", bill.attachmentName] as [string, string]] : []),
  ];
  for (const [k, v] of rows) {
    text(k, M, y, 9, font, MUTED);
    text(v, M + 150, y, 10, bold);
    y -= 18;
  }

  y -= 10;
  page.drawRectangle({ x: M, y, width: W - 2 * M, height: 0.6, color: rgb(0.85, 0.83, 0.78) });
  y -= 26;
  const money: Array<[string, number, boolean]> = [
    ['Taxable value', Number(bill.amount), false],
    ['GST', Number(bill.gstAmount ?? 0), false],
    ['Total payable', gross, true],
  ];
  for (const [k, v, strong] of money) {
    text(k, M, y, strong ? 11 : 10, strong ? bold : font, strong ? CHARCOAL : MUTED);
    right(inr(v), W - M, y, strong ? 12 : 10, strong ? bold : font);
    y -= strong ? 22 : 18;
  }

  y -= 14;
  text('PAYMENT', M, y, 10, bold, GOLD);
  y -= 18;
  if (voucher) {
    for (const [k, v] of [
      ['Voucher', voucher.number],
      ['Paid on', voucher.voucherDate ? voucher.voucherDate.toLocaleDateString('en-IN') : '—'],
      ['Amount paid out', inr(Number(voucher.amount))],
      ['Mode', voucher.mode ?? '—'],
      ['UTR / reference', voucher.utr ?? '—'],
      ['Voucher status', voucher.status],
    ] as Array<[string, string]>) {
      text(k, M, y, 9, font, MUTED);
      text(v, M + 150, y, 10, bold);
      y -= 18;
    }
  } else {
    text('No payment has been raised against this bill yet.', M, y, 10, font, MUTED);
    y -= 18;
  }

  page.drawText(ascii(`Generated ${new Date().toLocaleString('en-IN')} from Ameya OS. This is an internal record, not a tax invoice.`),
    { x: M, y: 44, size: 7.5, font, color: MUTED });

  const bytes = await doc.save();
  await writeAudit({
    actorId: ctx.user.id, action: 'DOWNLOAD', entityType: 'VendorBill', entityId: id,
    summary: `Downloaded a PDF copy of supplier bill ${bill.number}`,
  }).catch(() => undefined);

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${bill.number.replace(/[^A-Za-z0-9._-]/g, '_')}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
