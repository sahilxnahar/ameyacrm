import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { RecordDetailView } from '@/components/vault/record-detail-view';

export const metadata: Metadata = { title: 'Due Diligence Record' };
export const dynamic = 'force-dynamic';

export default async function DueDiligenceRecordPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('land.view');
  const { id } = await params;
  const r = await prisma.dueDiligenceRecord.findUnique({ where: { id }, include: { project: { select: { name: true } } } }).catch(() => null);
  if (!r) notFound();
  return (
    <RecordDetailView
      record={{
        id: r.id, project: r.project?.name ?? '—', recordType: r.recordType, state: r.state, region: r.region,
        authorityName: r.authorityName, reference: r.reference, documentUrl: r.documentUrl,
        validUntil: r.validUntil?.toISOString() ?? null, status: r.verificationStatus, note: r.note,
        createdAt: r.createdAt.toISOString(),
      }}
    />
  );
}
