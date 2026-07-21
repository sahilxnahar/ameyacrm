'use client';
import { RegisterScreen } from '@/components/common/register-screen';
import { createTenancy } from '@/server/actions/operations';
const inr = (n: number) => n.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const fmt = (d: Date | null) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—');
interface Row { id: string; unitCode: string; tenant: string; areaSqft: number | null; monthlyRent: number; escalationPct: number | null; startsOn: Date | null; endsOn: Date | null; status: string; }
const ST = ['ACTIVE', 'EXPIRING', 'VACATED'];
export function LeasingRegister({ canManage, projects, projectId, rows }: { canManage: boolean; projects: Array<{ id: string; name: string }>; projectId: string | null; rows: Row[] }) {
  const monthly = rows.filter((r) => r.status === 'ACTIVE').reduce((s, r) => s + r.monthlyRent, 0);
  return <RegisterScreen<Row> basePath="/leasing" projects={projects} projectId={projectId} canManage={canManage} rows={rows}
    addLabel="Add tenancy" emptyText="No commercial tenancies. The rent roll — every tenancy, area, rate, term and escalation, on one screen."
    onCreate={(v) => createTenancy({ ...v, projectId: projectId ?? '' })}
    tiles={[{ label: 'Tenancies', value: String(rows.length) }, { label: 'Monthly rent', value: inr(monthly), sub: 'active' }, { label: 'Active', value: String(rows.filter((r) => r.status === 'ACTIVE').length) }]}
    columns={[{ label: 'Unit', render: (r) => r.unitCode }, { label: 'Tenant', render: (r) => r.tenant }, { label: 'Area', render: (r) => (r.areaSqft != null ? `${r.areaSqft} sqft` : '—') }, { label: 'Rent/mo', render: (r) => inr(r.monthlyRent) }, { label: 'Escal.', render: (r) => (r.escalationPct != null ? `${r.escalationPct}%` : '—') }, { label: 'Ends', render: (r) => fmt(r.endsOn) }, { label: 'Status', render: (r) => r.status.toLowerCase() }]}
    fields={[{ name: 'unitCode', label: 'Unit code', required: true }, { name: 'tenant', label: 'Tenant', required: true }, { name: 'areaSqft', label: 'Area (sqft)', type: 'number' }, { name: 'monthlyRent', label: 'Monthly rent', type: 'currency' }, { name: 'escalationPct', label: 'Escalation %', type: 'number', advanced: true }, { name: 'startsOn', label: 'Starts', type: 'date', advanced: true }, { name: 'endsOn', label: 'Ends', type: 'date', advanced: true }, { name: 'status', label: 'Status', type: 'select', options: ST.map((v) => ({ value: v, label: v.toLowerCase() })) }]}
  />;
}
