import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requirePermission } from '@/lib/auth/current-user';
import { toCsv } from '@/server/services/report-service';
import { writeAudit } from '@/lib/audit/log';
import { bookingScope } from '@/lib/rbac/scope';

export async function GET() {
  const ctx = await requirePermission('report.export');
  // AMH-059: same hierarchy scope the on-screen lists and leads.csv apply — a
  // milestone is only as visible as the booking it hangs off.
  const scope = await bookingScope(ctx);
  const ms = await prisma.paymentMilestone.findMany({ where: Object.keys(scope).length ? { booking: scope } : {}, include: { booking: { select: { reference: true, lead: { select: { name: true } } } } }, take: 20000, orderBy: [{ dueDate: 'asc' }] });
  const csv = toCsv(ms.map((m) => ({
    booking: m.booking?.reference ?? '', buyer: m.booking?.lead?.name ?? '', milestone: m.label, amount: Number(m.amount),
    dueDate: m.dueDate?.toISOString() ?? '', status: m.status, paidAt: m.paidAt?.toISOString() ?? '',
  })));
  await writeAudit({ actorId: ctx.user.id, action: 'EXPORT', entityType: 'PaymentMilestone', summary: 'Exported collections CSV' });
  return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="collections.csv"' } });
}
