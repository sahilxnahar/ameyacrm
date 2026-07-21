'use client';
import { RegisterScreen } from '@/components/common/register-screen';
import { createMaintenance } from '@/server/actions/operations';
const inr = (n: number) => n.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const fmt = (d: Date | null) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—');
interface Row { id: string; unitCode: string; period: string | null; amount: number; status: string; dueOn: Date | null; }
const ST = ['RAISED', 'PAID', 'OVERDUE'];
export function AssociationRegister({ canManage, projects, projectId, rows }: { canManage: boolean; projects: Array<{ id: string; name: string }>; projectId: string | null; rows: Row[] }) {
  const overdue = rows.filter((r) => r.status === 'OVERDUE').length;
  return <RegisterScreen<Row> basePath="/association" projects={projects} projectId={projectId} canManage={canManage} rows={rows}
    addLabel="Raise CAM charge" emptyText="No maintenance charges. Raise common-area maintenance per unit, aged and collected like any other demand."
    onCreate={(v) => createMaintenance({ ...v, projectId: projectId ?? '' })}
    tiles={[{ label: 'Charges', value: String(rows.length) }, { label: 'Overdue', value: String(overdue), tone: overdue > 0 ? 'bad' : 'good' }, { label: 'Billed', value: inr(rows.reduce((s, r) => s + r.amount, 0)) }]}
    columns={[{ label: 'Unit', render: (r) => r.unitCode }, { label: 'Period', render: (r) => r.period ?? '—' }, { label: 'Amount', render: (r) => inr(r.amount) }, { label: 'Due', render: (r) => fmt(r.dueOn) }, { label: 'Status', render: (r) => r.status.toLowerCase() }]}
    fields={[{ name: 'unitCode', label: 'Unit code', required: true }, { name: 'period', label: 'Period', placeholder: 'Jul 2026' }, { name: 'amount', label: 'Amount (₹)', type: 'number' }, { name: 'dueOn', label: 'Due on', type: 'date' }, { name: 'status', label: 'Status', type: 'select', options: ST.map((v) => ({ value: v, label: v.toLowerCase() })) }]}
  />;
}
