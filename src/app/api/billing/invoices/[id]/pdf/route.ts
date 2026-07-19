import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getCurrentUser } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { brand } from '@/config/brand';
import { buildInvoicePdf } from '@/lib/pdf/invoice-pdf';
import { writeAudit } from '@/lib/audit/log';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getCurrentUser();
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!can(ctx.permissions, 'billing.view')) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { id } = await params;
  const inv = await prisma.invoice.findUnique({ where: { id }, include: { items: true, project: { select: { name: true } } } });
  if (!inv) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const bytes = await buildInvoicePdf({
    number: inv.number, clientName: inv.clientName, clientGstin: inv.clientGstin, status: inv.status,
    issueDate: inv.issueDate, dueDate: inv.dueDate,
    subTotal: Number(inv.subTotal), cgst: Number(inv.cgst), sgst: Number(inv.sgst), igst: Number(inv.igst), total: Number(inv.total),
    notes: inv.notes, project: inv.project?.name ?? null,
    company: { name: brand.company.displayName, tagline: brand.company.tagline, website: brand.company.website, reraNote: brand.company.reraNote },
    items: inv.items.map((i) => ({ description: i.description, hsnSac: i.hsnSac, quantity: Number(i.quantity), rate: Number(i.rate), gstRate: Number(i.gstRate), amount: Number(i.amount) })),
  });

  await writeAudit({ actorId: ctx.user.id, action: 'EXPORT', entityType: 'Invoice', entityId: id, summary: `Invoice PDF ${inv.number}` });
  return new NextResponse(Buffer.from(bytes) as BodyInit, {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${inv.number}.pdf"` },
  });
}
