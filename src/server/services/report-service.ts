import 'server-only';
import { prisma } from '@/lib/db/prisma';

export async function getReportData() {
  const [byStatus, byPriority, deptRows, leadsByStatus] = await Promise.all([
    prisma.task.groupBy({ by: ['status'], _count: true, where: { deletedAt: null } }),
    prisma.task.groupBy({ by: ['priority'], _count: true, where: { deletedAt: null } }),
    prisma.department.findMany({ select: { name: true, _count: { select: { tasks: true } } } }),
    prisma.lead.groupBy({ by: ['status'], _count: true, where: { deletedAt: null } }),
  ]);
  return {
    tasksByStatus: byStatus.map((r) => ({ name: r.status, value: r._count })),
    tasksByPriority: byPriority.map((r) => ({ name: r.priority, value: r._count })),
    departmentWorkload: deptRows.map((d) => ({ name: d.name, tasks: d._count.tasks })).sort((a, b) => b.tasks - a.tasks).slice(0, 10),
    leadsByStatus: leadsByStatus.map((r) => ({ name: r.status, value: r._count })),
  };
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]!);
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n');
}
