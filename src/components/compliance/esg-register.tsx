'use client';
import { RegisterScreen } from '@/components/common/register-screen';
import { createEnvCondition } from '@/server/actions/compliance';
const fmt = (d: Date | null) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—');
interface Row { id: string; condition: string; authority: string | null; status: string; dueOn: Date | null; evidence: string | null; }
const ST = ['PENDING', 'IN_PROGRESS', 'COMPLIED', 'BREACHED'];
const opt = (a: string[]) => a.map((v) => ({ value: v, label: v.replace(/_/g, ' ').toLowerCase() }));
export function EsgRegister({ canManage, projects, projectId, rows }: { canManage: boolean; projects: Array<{ id: string; name: string }>; projectId: string | null; rows: Row[] }) {
  const breached = rows.filter((r) => r.status === 'BREACHED').length;
  return (
    <RegisterScreen<Row>
      basePath="/esg" projects={projects} projectId={projectId} canManage={canManage} rows={rows}
      addLabel="Add EC condition" emptyText="No environmental clearance conditions tracked. Add each condition with its evidence and reporting date — conditions are where clearances are actually breached."
      onCreate={(v) => createEnvCondition({ ...v, projectId: projectId ?? '' })}
      tiles={[{ label: 'Conditions', value: String(rows.length) }, { label: 'Breached', value: String(breached), tone: breached > 0 ? 'bad' : 'good' }, { label: 'Complied', value: String(rows.filter((r) => r.status === 'COMPLIED').length) }]}
      columns={[{ label: 'Condition', render: (r) => r.condition }, { label: 'Authority', render: (r) => r.authority ?? '—' }, { label: 'Due', render: (r) => fmt(r.dueOn) }, { label: 'Status', render: (r) => <span className={r.status === 'BREACHED' ? 'text-destructive' : r.status === 'COMPLIED' ? 'text-emerald-600' : ''}>{r.status.replace(/_/g, ' ').toLowerCase()}</span> }]}
      fields={[{ name: 'condition', label: 'Condition', type: 'textarea', required: true }, { name: 'authority', label: 'Authority' }, { name: 'evidence', label: 'Evidence held' }, { name: 'dueOn', label: 'Reporting due', type: 'date' }, { name: 'status', label: 'Status', type: 'select', options: opt(ST) }]}
    />
  );
}
