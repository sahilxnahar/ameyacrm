import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { DueDiligenceView } from '@/components/legal/due-diligence-view';

export const metadata: Metadata = { title: 'Due Diligence & RERA Vault' };
export const dynamic = 'force-dynamic';

export default async function DueDiligencePage() {
  await requirePermission('land.view');
  const [records, projects] = await Promise.all([
    prisma.dueDiligenceRecord.findMany({ orderBy: [{ verificationStatus: 'asc' }, { createdAt: 'desc' }], take: 300, include: { project: { select: { name: true } } } }).catch(() => []),
    prisma.project.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }).catch(() => []),
  ]);
  const now = Date.now();
  return (
    <div className="space-y-6">
      <PageHeader title="Pan-India Due Diligence & RERA Vault" description="A directory of every state and local authority portal — RERA, land records, registration, town planning, municipal and hill-area bodies — with a one-click jump to the official site and a drag-in vault to file the fetched record against a project." />
      <DueDiligenceView projects={projects}
        records={records.map((r) => ({
          id: r.id, project: r.project?.name ?? '—', recordType: r.recordType, state: r.state, region: r.region,
          authorityName: r.authorityName, reference: r.reference, documentUrl: r.documentUrl,
          validUntil: r.validUntil?.toISOString() ?? null, status: r.verificationStatus,
          expiring: (() => {
            const watched = r.recordType === 'TOWN_PLANNING_APPROVAL' || r.recordType === 'ENCUMBRANCE_CERTIFICATE';
            if (!watched || r.verificationStatus === 'REJECTED') return false;
            if (r.validUntil) return r.validUntil.getTime() <= now + 30 * 864e5;
            return r.createdAt.getTime() < now - 182 * 864e5;
          })(),
        }))} />
    </div>
  );
}
