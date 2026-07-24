import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requirePermission } from '@/lib/auth/current-user';
import { toCsv } from '@/server/services/report-service';
import { writeAudit } from '@/lib/audit/log';

export async function GET() {
  const ctx = await requirePermission('audit.export');
  const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 10000, include: { actor: { select: { name: true } } } });
  const csv = toCsv(logs.map((l) => ({
    time: l.createdAt.toISOString(), actor: l.actor?.name ?? 'System', action: l.action,
    entityType: l.entityType ?? '', entityId: l.entityId ?? '', summary: l.summary ?? '', ip: l.ipAddress ?? '',
  })));
  await writeAudit({ actorId: ctx.user.id, action: 'EXPORT', entityType: 'AuditLog', summary: 'Exported audit CSV' });
  return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="audit.csv"' } });
}
