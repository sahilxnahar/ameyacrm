import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { ListNotice } from '@/components/ui/list-notice';
import { listWindow, listMeta } from '@/lib/list/page-window';
import { UanValidatorView } from '@/components/legal/uan-validator-view';

export const metadata: Metadata = { title: 'UAN Validator' };
export const dynamic = 'force-dynamic';

export default async function UanValidatorPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePermission('procurement.view');
  const win = listWindow(await searchParams, 300);
  const [rows, labourUanTotal, vendors, valid, invalid] = await Promise.all([
    prisma.labourUan.findMany({ orderBy: [{ status: 'asc' }, { createdAt: 'desc' }], take: win.take, include: { vendor: { select: { name: true } } } }).catch(() => []),
    prisma.labourUan.count().catch(() => 0),
    prisma.vendor.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }).catch(() => []),
    prisma.labourUan.count({ where: { status: 'VALID' } }).catch(() => 0),
    prisma.labourUan.count({ where: { status: 'INVALID' } }).catch(() => 0),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title="EPF / ESI UAN bulk validator" description="Pre-gate validation of contractor labour UANs at the security checkpoint. Paste a roster and every 12-digit Universal Account Number is format-checked instantly — an invalid UAN is flagged before the worker is let in, so EPF/ESI coverage is confirmed at the gate." />
      <UanValidatorView vendors={vendors} counts={{ valid, invalid, total: labourUanTotal }}
        rows={rows.map((u) => ({ id: u.id, workerName: u.workerName, uan: u.uan, status: u.status, vendor: u.vendor?.name ?? null }))} />
      <ListNotice meta={listMeta(rows.length, labourUanTotal, win)} noun="UAN records" />
    </div>
  );
}
