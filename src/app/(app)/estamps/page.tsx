import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { EstampsView } from '@/components/legal/estamps-view';

export const metadata: Metadata = { title: 'e-Stamping' };
export const dynamic = 'force-dynamic';

export default async function EstampsPage() {
  await requirePermission('booking.view');
  const [rows, projects, generated, pending] = await Promise.all([
    prisma.estampCertificate.findMany({ orderBy: { createdAt: 'desc' }, take: 200, include: { project: { select: { name: true } } } }).catch(() => []),
    prisma.project.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }).catch(() => []),
    prisma.estampCertificate.count({ where: { status: 'GENERATED' } }).catch(() => 0),
    prisma.estampCertificate.count({ where: { status: 'REQUESTED' } }).catch(() => 0),
  ]);
  const dutyAgg = await prisma.estampCertificate.aggregate({ _sum: { dutyInr: true } }).catch(() => ({ _sum: { dutyInr: null } }));
  return (
    <div className="space-y-6">
      <PageHeader title="e-Stamping & franking (SHCIL)" description="Digital stamp-paper for agreements and sale deeds. Record the duty and party details; once SHCIL is connected, a generated certificate number lands here automatically via the webhook bus. Runs in manual mode until the API is live." />
      <EstampsView projects={projects} counts={{ generated, pending, duty: Number(dutyAgg._sum.dutyInr ?? 0) }}
        rows={rows.map((e) => ({ id: e.id, purpose: e.purpose, status: e.status, dutyInr: Number(e.dutyInr), considerationInr: e.considerationInr != null ? Number(e.considerationInr) : null, certificateNo: e.certificateNo, firstParty: e.firstParty, secondParty: e.secondParty, issuedOn: e.issuedOn?.toISOString() ?? null, project: e.project?.name ?? null }))} />
    </div>
  );
}
