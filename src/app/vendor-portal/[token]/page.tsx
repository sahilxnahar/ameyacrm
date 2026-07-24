import type { Metadata } from 'next';
import { Building2, ReceiptText, Wallet, ClipboardList } from 'lucide-react';
import { getVendorPortal } from '@/server/services/vendor-portal-service';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatCurrency, formatCompactCurrency, formatDate } from '@/lib/utils/format';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Vendor Portal · Ameya Heights', robots: { index: false } };

export default async function VendorPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await getVendorPortal(token);

  if (!data) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center p-6 text-center">
        <h1 className="font-display text-2xl font-semibold text-brass">Ameya Heights</h1>
        <p className="mt-3 text-sm text-muted-foreground">This portal link is invalid or has been withdrawn. Please contact our accounts office for a new link.</p>
      </main>
    );
  }

  const { vendor, purchaseOrders, bills, payments, totals } = data;

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <header className="flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-brass">Ameya Heights</h1>
          <p className="text-sm text-muted-foreground">Supplier statement for {vendor.name}{vendor.gstin ? ` · GSTIN ${vendor.gstin}` : ''}</p>
        </div>
        <Building2 className="h-8 w-8 text-brass/60" />
      </header>

      <section className="grid grid-cols-3 gap-3">
        <Tile label="Billed" value={formatCompactCurrency(totals.billed)} />
        <Tile label="Paid" value={formatCompactCurrency(totals.paid)} tone="good" />
        <Tile label="Outstanding" value={formatCompactCurrency(totals.outstanding)} tone={totals.outstanding > 0 ? 'bad' : 'default'} />
      </section>

      <Section title="Payments received" icon={<Wallet className="h-5 w-5 text-brass" />}>
        {payments.length === 0 ? <Empty>No payments recorded yet.</Empty> : (
          <Table head={['Voucher', 'Date', 'Amount', 'UTR', 'Status']}>
            {payments.map((p) => (
              <tr key={p.number} className="border-t">
                <td className="p-2 font-medium">{p.number}</td>
                <td className="p-2">{formatDate(p.voucherDate)}</td>
                <td className="p-2 tabular-nums">{formatCurrency(p.amount)}</td>
                <td className="p-2 font-mono text-xs">{p.utr ?? '—'}</td>
                <td className="p-2"><StatusBadge status={p.status} /></td>
              </tr>
            ))}
          </Table>
        )}
      </Section>

      <Section title="Bills" icon={<ReceiptText className="h-5 w-5 text-brass" />}>
        {bills.length === 0 ? <Empty>No bills on record.</Empty> : (
          <Table head={['Bill', 'Date', 'Due', 'Amount', 'Status']}>
            {bills.map((b) => (
              <tr key={b.number} className="border-t">
                <td className="p-2 font-medium">{b.number}</td>
                <td className="p-2">{formatDate(b.billDate)}</td>
                <td className="p-2">{b.dueDate ? formatDate(b.dueDate) : '—'}</td>
                <td className="p-2 tabular-nums">{formatCurrency(b.amount + b.gstAmount)}</td>
                <td className="p-2"><StatusBadge status={b.status} /></td>
              </tr>
            ))}
          </Table>
        )}
      </Section>

      <Section title="Purchase orders" icon={<ClipboardList className="h-5 w-5 text-brass" />}>
        {purchaseOrders.length === 0 ? <Empty>No purchase orders yet.</Empty> : (
          <Table head={['PO', 'Date', 'Total', 'Status']}>
            {purchaseOrders.map((p) => (
              <tr key={p.number} className="border-t">
                <td className="p-2 font-medium">{p.number}</td>
                <td className="p-2">{formatDate(p.orderDate)}</td>
                <td className="p-2 tabular-nums">{formatCurrency(p.total)}</td>
                <td className="p-2"><StatusBadge status={p.status} /></td>
              </tr>
            ))}
          </Table>
        )}
      </Section>

      <p className="pb-8 text-center text-xs text-muted-foreground">A read-only statement from Ameya Heights. Figures are indicative; please contact the accounts office with any query.</p>
    </main>
  );
}

function Tile({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'good' | 'bad' }) {
  return (
    <div className="card-surface rounded-lg border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 font-display text-lg font-semibold ${tone === 'good' ? 'text-success' : tone === 'bad' ? 'text-destructive' : ''}`}>{value}</div>
    </div>
  );
}
function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border p-4 sm:p-5">
      <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">{icon} {title}</h2>
      {children}
    </section>
  );
}
function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs text-muted-foreground"><tr className="text-left">{head.map((h) => <th key={h} className="p-2">{h}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}
