import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { GstrReconView } from '@/components/finance/gstr-recon-view';
import { ListNotice } from '@/components/ui/list-notice';
import { listWindow, listMeta } from '@/lib/list/page-window';
import { getGstrSummary } from '@/server/services/gstr-service';

export const metadata: Metadata = { title: 'GSTR-2B Reconciliation' };
export const dynamic = 'force-dynamic';

export default async function GstrReconPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePermission('billing.view');
  // A line stuck at row 301 is input tax credit nobody claimed.
  const win = listWindow(await searchParams, 300);
  const [rows, lineTotal, summary] = await Promise.all([
    prisma.gstr2bLine.findMany({ orderBy: [{ status: 'asc' }, { invoiceDate: 'desc' }], take: win.take }).catch(() => []),
    prisma.gstr2bLine.count().catch(() => 0),
    getGstrSummary(),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title="GSTR-2B auto-reconciliation" description="Upload the GSTR-2B export and every supplier invoice is matched against your vendor bills — matched, amount-mismatch, or missing. Match before you claim Input Tax Credit or clear a payment, so a supplier who hasn't filed can't cost you the ITC." />
      <GstrReconView summary={summary}
        rows={rows.map((l) => ({ id: l.id, supplierGstin: l.supplierGstin, invoiceNo: l.invoiceNo, period: l.period, taxableValue: Number(l.taxableValue), tax: Number(l.igst) + Number(l.cgst) + Number(l.sgst), status: l.status, invoiceDate: l.invoiceDate?.toISOString() ?? null }))} />
      <ListNotice meta={listMeta(rows.length, lineTotal, win)} noun="invoice lines" />
    </div>
  );
}
