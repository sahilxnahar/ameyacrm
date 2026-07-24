import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getCurrentUser } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { brand } from '@/config/brand';
import { KIND_META, PAY_MODE_LABEL, type VoucherKind } from '@/config/vouchers';
import { buildPaymentReceiptPdf } from '@/lib/pdf/payment-receipt-pdf';
import { getCompanyDetails } from '@/server/services/company-service';
import { writeAudit } from '@/lib/audit/log';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getCurrentUser();
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!can(ctx.permissions, 'finance.ledger.view')) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { id } = await params;
  const v = await prisma.voucher.findUnique({ where: { id } });
  if (!v) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const [co, project, preparer] = await Promise.all([
    getCompanyDetails(),
    v.projectId ? prisma.project.findUnique({ where: { id: v.projectId }, select: { name: true } }) : Promise.resolve(null),
    v.createdById ? prisma.user.findUnique({ where: { id: v.createdById }, select: { name: true } }) : Promise.resolve(null),
  ]);

  const meta = KIND_META[v.kind as VoucherKind];
  const bytes = await buildPaymentReceiptPdf({
    number: v.number,
    kindLabel: meta?.label ?? String(v.kind),
    direction: meta?.direction === 'in' ? 'received' : 'paid',
    status: v.status,
    voucherDate: v.voucherDate,
    paidOn: v.paidOn,
    partyName: v.partyName,
    partyPhone: v.partyPhone,
    amount: Number(v.amount),
    mode: PAY_MODE_LABEL[v.mode] ?? v.mode,
    utr: v.utr,
    bankName: v.bankName,
    reference: v.reference,
    narration: v.narration,
    project: project?.name ?? null,
    preparedBy: preparer?.name ?? null,
    cancelReason: v.cancelReason,
    company: {
      name: co.legalName || brand.company.displayName,
      tagline: brand.company.tagline,
      website: co.website || brand.company.website,
      gstin: co.gstin, pan: co.pan, registeredAddress: co.registeredAddress,
      bankName: co.bankName, bankAccountNumber: co.bankAccountNumber, bankIfsc: co.bankIfsc,
      phone: co.phone, email: co.email,
    },
  });

  await writeAudit({ actorId: ctx.user.id, action: 'EXPORT', entityType: 'Voucher', entityId: id, summary: `Receipt PDF ${v.number}` });
  return new NextResponse(Buffer.from(bytes) as BodyInit, {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${v.number}.pdf"` },
  });
}
