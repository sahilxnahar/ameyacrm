import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requirePermission } from '@/lib/auth/current-user';
import { toCsv } from '@/server/services/report-service';
import { writeAudit } from '@/lib/audit/log';

export async function GET() {
  const ctx = await requirePermission('report.export');
  const tasks = await prisma.task.findMany({ where: { deletedAt: null }, include: { department: { select: { name: true } }, project: { select: { name: true } } }, take: 5000 });
  const csv = toCsv(tasks.map((t) => ({
    reference: t.reference, title: t.title, status: t.status, priority: t.priority,
    department: t.department?.name ?? '', project: t.project?.name ?? '',
    dueDate: t.dueDate?.toISOString() ?? '', createdAt: t.createdAt.toISOString(),
  })));
  await writeAudit({ actorId: ctx.user.id, action: 'EXPORT', entityType: 'Task', summary: 'Exported tasks CSV' });
  return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="tasks.csv"' } });
}
