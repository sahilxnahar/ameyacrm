import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { PageHeader } from '@/components/layout/page-header';
import { recentInvoicesForFiling } from '@/server/actions/gst-filing';
import { GstFilingView } from '@/components/gst/gst-filing-view';

export const metadata: Metadata = { title: 'GST Filing (offline JSON)' };
export const dynamic = 'force-dynamic';

export default async function GstFilingPage() {
  await requirePermission('finance.ledger.view');
  const res = await recentInvoicesForFiling();
  const invoices = 'ok' in res ? res.rows : [];
  return (
    <div className="space-y-6">
      <PageHeader title="GST filing" description="Generate filing-ready JSON from your own invoices — GSTR-1 for the month, and e-invoice / e-way-bill per invoice. Download and upload it to the GST, IRP or e-way-bill portal, or import into Tally. Nothing is transmitted from here; always have your CA review before filing." />
      <GstFilingView invoices={invoices} />
    </div>
  );
}
