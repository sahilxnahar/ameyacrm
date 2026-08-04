import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { KhataVaultView } from '@/components/legal/khata-vault-view';

export const metadata: Metadata = { title: 'Khata & EC Vault' };
export const dynamic = 'force-dynamic';

export default async function KhataVaultPage() {
  await requirePermission('land.view');
  const [rows, projects, aKhata, ecClear] = await Promise.all([
    prisma.khataRecord.findMany({ orderBy: { createdAt: 'desc' }, take: 300, include: { project: { select: { name: true } } } }).catch(() => []),
    prisma.project.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }).catch(() => []),
    prisma.khataRecord.count({ where: { khataType: 'A_KHATA' } }).catch(() => 0),
    prisma.khataRecord.count({ where: { ecClear: true } }).catch(() => 0),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title="Property tax (Khata) & EC vault" description="A-Khata / B-Khata bifurcation, BBMP PID mapping and the encumbrance-certificate register in one place — so a title's marketability and property-tax standing are clear at a glance." />
      <KhataVaultView projects={projects} counts={{ total: rows.length, aKhata, ecClear }}
        rows={rows.map((k) => ({ id: k.id, khataType: k.khataType, pid: k.pid, khataNo: k.khataNo, assessmentNo: k.assessmentNo, ownerName: k.ownerName, lastEcOn: k.lastEcOn?.toISOString() ?? null, ecClear: k.ecClear, project: k.project?.name ?? null }))} />
    </div>
  );
}
