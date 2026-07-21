'use client';
import { RegisterScreen } from '@/components/common/register-screen';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatCompactCurrency as compactINR } from '@/lib/utils/format';
import { createVariation } from '@/server/actions/operations';
const inr = (n: number) => n.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const fmt = (d: Date) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
interface Row { id: string; title: string; bookingRef: string | null; amount: number; status: string; raisedOn: Date; }
const ST = ['RAISED', 'COSTED', 'APPROVED', 'ACCEPTED', 'BILLED', 'REJECTED'];
export function VariationsRegister({ canManage, projects, projectId, rows }: { canManage: boolean; projects: Array<{ id: string; name: string }>; projectId: string | null; rows: Row[] }) {
  const open = rows.filter((r) => !['BILLED', 'REJECTED'].includes(r.status)).length;
  return <RegisterScreen<Row> basePath="/variations" projects={projects} projectId={projectId} canManage={canManage} rows={rows}
    addLabel="Raise variation" emptyText="No variation orders. Raise a buyer change here — priced and agreed before the work is done, not argued at handover."
    onCreate={(v) => createVariation({ ...v, projectId: projectId ?? '' })}
    tiles={[{ label: 'Variations', value: String(rows.length) }, { label: 'Open', value: String(open), tone: open > 0 ? 'bad' : 'default' }, { label: 'Value', value: compactINR(rows.reduce((s, r) => s + r.amount, 0)) }]}
    columns={[{ label: 'Variation', render: (r) => r.title }, { label: 'Booking', render: (r) => r.bookingRef ?? '—' }, { label: 'Amount', render: (r) => inr(r.amount) }, { label: 'Status', render: (r) => <StatusBadge status={r.status} /> }, { label: 'Raised', render: (r) => fmt(r.raisedOn) }]}
    fields={[{ name: 'title', label: 'Variation', required: true }, { name: 'bookingRef', label: 'Booking ref' }, { name: 'amount', label: 'Amount', type: 'currency' }, { name: 'status', label: 'Status', type: 'select', options: ST.map((v) => ({ value: v, label: v.toLowerCase() })) }, { name: 'description', label: 'Description', type: 'textarea', advanced: true }]}
  />;
}
