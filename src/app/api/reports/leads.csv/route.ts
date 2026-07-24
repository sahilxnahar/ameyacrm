import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requirePermission } from '@/lib/auth/current-user';
import { toCsv } from '@/server/services/report-service';
import { writeAudit } from '@/lib/audit/log';

export async function GET() {
  const ctx = await requirePermission('report.export');
  const leads = await prisma.lead.findMany({ where: { deletedAt: null }, include: { owner: { select: { name: true } }, project: { select: { name: true } } }, take: 10000, orderBy: { createdAt: 'desc' } });
  const csv = toCsv(leads.map((l) => ({
    reference: l.reference, name: l.name, email: l.email ?? '', phone: l.phone ?? '', source: l.source, status: l.status,
    owner: l.owner?.name ?? '', project: l.project?.name ?? '', budgetMax: l.budgetMax ? Number(l.budgetMax) : '', createdAt: l.createdAt.toISOString(),
  })));
  await writeAudit({ actorId: ctx.user.id, action: 'EXPORT', entityType: 'Lead', summary: 'Exported leads CSV' });
  return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="leads.csv"' } });
}
