import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { ArbitrationView } from '@/components/legal/arbitration-view';

export const metadata: Metadata = { title: 'Arbitration & ADR' };
export const dynamic = 'force-dynamic';

export default async function ArbitrationPage() {
  await requirePermission('land.view');
  const [rows, projects, vendors, hearingSoon] = await Promise.all([
    prisma.adrCase.findMany({ orderBy: [{ nextHearingOn: 'asc' }], take: 200, include: { project: { select: { name: true } }, vendor: { select: { name: true } } } }).catch(() => []),
    prisma.project.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }).catch(() => []),
    prisma.vendor.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }).catch(() => []),
    prisma.adrCase.count({ where: { nextHearingOn: { not: null, lte: new Date(Date.now() + 7 * 864e5) }, stage: { notIn: ['SETTLED', 'CLOSED'] } } }).catch(() => 0),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title="Arbitration & ADR Docket" description="Conciliation notices, arbitrator appointments, hearings and settlements — every alternative-dispute matter with its next hearing date front and centre, so nothing is missed and settlements land on a voucher." />
      <ArbitrationView projects={projects} vendors={vendors} counts={{ total: rows.length, hearingSoon }}
        rows={rows.map((c) => ({ id: c.id, title: c.title, refNo: c.refNo, stage: c.stage, claimant: c.claimant, respondent: c.respondent, arbitrator: c.arbitrator, claimAmount: c.claimAmount != null ? Number(c.claimAmount) : null, nextHearingOn: c.nextHearingOn?.toISOString() ?? null, project: c.project?.name ?? null, vendor: c.vendor?.name ?? null }))} />
    </div>
  );
}
