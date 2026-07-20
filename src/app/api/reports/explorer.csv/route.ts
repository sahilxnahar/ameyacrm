import { NextResponse, type NextRequest } from 'next/server';
import { requirePermission } from '@/lib/auth/current-user';
import { toCsv } from '@/server/services/report-service';
import { runExplorer, type ExplorerEntity } from '@/server/services/explorer-service';
import { writeAudit } from '@/lib/audit/log';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const ctx = await requirePermission('report.export');
  const sp = req.nextUrl.searchParams;
  const entity = (sp.get('entity') || 'leads') as ExplorerEntity;
  const filters = { status: sp.get('status') || undefined, source: sp.get('source') || undefined, ownerId: sp.get('ownerId') || undefined, projectId: sp.get('projectId') || undefined, q: sp.get('q') || undefined, from: sp.get('from') || undefined, to: sp.get('to') || undefined };
  const res = await runExplorer(entity, filters, 10000);
  await writeAudit({ actorId: ctx.user.id, action: 'EXPORT', entityType: entity, summary: `Explorer export (${res.rows.length} rows)` });
  return new NextResponse(toCsv(res.rows), { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="${entity}-export.csv"` } });
}
