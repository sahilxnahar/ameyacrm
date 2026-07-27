import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { AppellateLitigationView } from '@/components/legal/appellate-litigation-view';

export const metadata: Metadata = { title: 'REAT & High Court' };
export const dynamic = 'force-dynamic';

export default async function AppellateLitigationPage() {
  await requirePermission('land.view');
  const [rows, projects, hearingSoon, live] = await Promise.all([
    prisma.litigationEscalation.findMany({ orderBy: [{ nextHearingOn: 'asc' }], take: 200, include: { project: { select: { name: true } } } }).catch(() => []),
    prisma.project.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }).catch(() => []),
    prisma.litigationEscalation.count({ where: { nextHearingOn: { not: null, lte: new Date(Date.now() + 7 * 864e5) }, status: { not: 'DISPOSED' } } }).catch(() => 0),
    prisma.litigationEscalation.count({ where: { status: { notIn: ['DISPOSED'] } } }).catch(() => 0),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title="REAT & High Court Litigation" description="The appellate docket — RERA Appellate Tribunal, High Court and above. Track interim orders, counsel assignment and the next hearing for each escalation, chained back to the matter it came from." />
      <AppellateLitigationView projects={projects} counts={{ live, hearingSoon }}
        rows={rows.map((c) => ({ id: c.id, title: c.title, forum: c.forum, status: c.status, caseNo: c.caseNo, counselName: c.counselName, interimOrder: c.interimOrder, disputedInr: c.disputedInr != null ? Number(c.disputedInr) : null, nextHearingOn: c.nextHearingOn?.toISOString() ?? null, project: c.project?.name ?? null }))} />
    </div>
  );
}
