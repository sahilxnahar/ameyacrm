import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { IpRegistryView } from '@/components/legal/ip-registry-view';

export const metadata: Metadata = { title: 'IP & Trademark Registry' };
export const dynamic = 'force-dynamic';

export default async function IpRegistryPage() {
  await requirePermission('document.view');
  const [rows, projects, registered, dueSoon, objected] = await Promise.all([
    prisma.trademark.findMany({ orderBy: [{ status: 'asc' }, { renewalDueOn: 'asc' }], take: 300, include: { project: { select: { name: true } } } }).catch(() => []),
    prisma.project.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }).catch(() => []),
    prisma.trademark.count({ where: { status: 'REGISTERED' } }).catch(() => 0),
    prisma.trademark.count({ where: { status: 'RENEWAL_DUE' } }).catch(() => 0),
    prisma.trademark.count({ where: { status: { in: ['OBJECTED', 'OPPOSED'] } } }).catch(() => 0),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title="IP & trademark registry" description="Every brand mark, its class and status, and the 10-year renewal computed automatically from the registration date. A mark flips to “Renewal due” on its own as the deadline nears (checked daily)." />
      <IpRegistryView
        counts={{ registered, dueSoon, objected, total: rows.length }}
        projects={projects}
        rows={rows.map((t) => ({
          id: t.id, mark: t.mark, proprietor: t.proprietor, niceClass: t.niceClass, status: t.status,
          applicationNo: t.applicationNo, projectName: t.project?.name ?? null, projectId: t.projectId,
          filedOn: t.filedOn?.toISOString() ?? null, registeredOn: t.registeredOn?.toISOString() ?? null,
          renewalDueOn: t.renewalDueOn?.toISOString() ?? null, deadlineOn: t.deadlineOn?.toISOString() ?? null,
          objectionText: t.objectionText, agentName: t.agentName,
        }))}
      />
    </div>
  );
}
