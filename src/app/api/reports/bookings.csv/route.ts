import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requirePermission } from '@/lib/auth/current-user';
import { toCsv } from '@/server/services/report-service';
import { writeAudit } from '@/lib/audit/log';

export async function GET() {
  const ctx = await requirePermission('report.export');
  const bookings = await prisma.booking.findMany({ include: { lead: { select: { name: true } }, unit: { select: { code: true } } }, take: 10000, orderBy: { createdAt: 'desc' } });
  const csv = toCsv(bookings.map((b) => ({
    reference: b.reference, buyer: b.lead?.name ?? '', unit: b.unit?.code ?? '', status: b.status, paymentStatus: b.paymentStatus,
    agreementValue: b.agreementValue ? Number(b.agreementValue) : '', bookedAt: b.bookedAt.toISOString(),
  })));
  await writeAudit({ actorId: ctx.user.id, action: 'EXPORT', entityType: 'Booking', summary: 'Exported bookings CSV' });
  return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="bookings.csv"' } });
}
