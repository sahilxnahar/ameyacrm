'use client';
import { RegisterScreen } from '@/components/common/register-screen';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatCompactCurrency as compactINR } from '@/lib/utils/format';
import { createExpense } from '@/server/actions/operations';
const inr = (n: number) => n.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const fmt = (d: Date | null) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—');
interface Row { id: string; claimant: string; category: string | null; amount: number; status: string; incurredOn: Date | null; }
const ST = ['SUBMITTED', 'APPROVED', 'PAID', 'REJECTED'];
export function ExpensesRegister({ canManage, projects, projectId, rows }: { canManage: boolean; projects: Array<{ id: string; name: string }>; projectId: string | null; rows: Row[] }) {
  const pending = rows.filter((r) => r.status === 'SUBMITTED').length;
  return <RegisterScreen<Row> basePath="/expenses" projects={projects} projectId={projectId} canManage={canManage} rows={rows}
    addLabel="Add expense claim" emptyText="No expense claims. Submitted, approved, paid — and posted to the ledger."
    onCreate={(v) => createExpense({ ...v, projectId: projectId ?? '' })}
    tiles={[{ label: 'Claims', value: String(rows.length) }, { label: 'Pending', value: String(pending), tone: pending > 0 ? 'bad' : 'default' }, { label: 'Total', value: compactINR(rows.reduce((s, r) => s + r.amount, 0)) }]}
    columns={[{ label: 'Claimant', render: (r) => r.claimant }, { label: 'Category', render: (r) => r.category ?? '—' }, { label: 'Amount', render: (r) => inr(r.amount) }, { label: 'Incurred', render: (r) => fmt(r.incurredOn) }, { label: 'Status', render: (r) => <StatusBadge status={r.status} /> }]}
    fields={[{ name: 'claimant', label: 'Claimant', required: true }, { name: 'category', label: 'Category', placeholder: 'travel, site, office…' }, { name: 'amount', label: 'Amount', type: 'currency' }, { name: 'incurredOn', label: 'Incurred on', type: 'date' }, { name: 'status', label: 'Status', type: 'select', options: ST.map((v) => ({ value: v, label: v.toLowerCase() })) }, { name: 'note', label: 'Note', advanced: true }]}
  />;
}
