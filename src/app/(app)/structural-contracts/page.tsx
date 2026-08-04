import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { StructuralContractsView } from '@/components/legal/structural-contracts-view';

export const metadata: Metadata = { title: 'Structural Contracts' };
export const dynamic = 'force-dynamic';

export default async function StructuralContractsPage() {
  await requirePermission('procurement.view');
  const [rows, projects, vendors, active, expiring] = await Promise.all([
    prisma.structuralContract.findMany({
      orderBy: [{ status: 'asc' }, { endOn: 'asc' }], take: 200,
      include: { project: { select: { name: true } }, vendor: { select: { name: true } }, certs: { orderBy: { period: 'desc' }, take: 6 } },
    }).catch(() => []),
    prisma.project.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }).catch(() => []),
    prisma.vendor.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }).catch(() => []),
    prisma.structuralContract.count({ where: { status: 'ACTIVE' } }).catch(() => 0),
    prisma.structuralContract.count({ where: { status: 'ACTIVE', endOn: { not: null, lte: new Date(Date.now() + 30 * 864e5) } } }).catch(() => 0),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title="Structural contracts & CLM" description="Structural contractors, their defect-liability periods, and the independent-engineer certification that gates payment. An uncertified period blocks the RA-bill settlement automatically — the gate is enforced server-side." />
      <StructuralContractsView
        projects={projects} vendors={vendors}
        counts={{ active, expiring, total: rows.length }}
        rows={rows.map((c) => ({
          id: c.id, title: c.title, contractNo: c.contractNo, status: c.status,
          project: c.project?.name ?? '—', vendor: c.vendor?.name ?? '—',
          endOn: c.endOn?.toISOString() ?? null, defectLiabilityEnd: c.defectLiabilityEnd?.toISOString() ?? null,
          value: c.value != null ? Number(c.value) : null,
          certs: c.certs.map((x) => ({ period: x.period, isCleared: x.isCleared })),
        }))}
      />
    </div>
  );
}
