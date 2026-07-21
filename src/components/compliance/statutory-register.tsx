'use client';
import { RegisterScreen } from '@/components/common/register-screen';
import { createObligation } from '@/server/actions/compliance';
const fmt = (d: Date | null) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—');
interface Row { id: string; title: string; kind: string; authority: string | null; frequency: string; owner: string | null; nextDue: Date | null; lastFiled: Date | null; status: string; }
const KINDS = ['GST', 'TDS', 'RERA', 'PF_ESI', 'PROFESSIONAL_TAX', 'INCOME_TAX', 'ROC', 'OTHER'];
const FREQ = ['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'ANNUAL', 'ONE_TIME'];
const STATUS = ['UPCOMING', 'DUE', 'FILED', 'OVERDUE'];
const opt = (a: string[]) => a.map((v) => ({ value: v, label: v.replace(/_/g, ' ').toLowerCase() }));
export function StatutoryRegister({ canManage, projects, projectId, rows }: { canManage: boolean; projects: Array<{ id: string; name: string }>; projectId: string | null; rows: Row[] }) {
  return (
    <RegisterScreen<Row>
      basePath="/statutory" projects={projects} projectId={projectId} canManage={canManage} rows={rows}
      addLabel="Add obligation" emptyText="No statutory obligations yet. Add each recurring filing with an owner and a chase-before date."
      onCreate={(v) => createObligation({ ...v, projectId: projectId ?? '' })}
      tiles={[{ label: 'Obligations', value: String(rows.length) }, { label: 'Overdue', value: String(rows.filter((r) => r.status === 'OVERDUE').length), tone: 'bad' }, { label: 'Due now', value: String(rows.filter((r) => r.status === 'DUE').length) }]}
      columns={[{ label: 'Title', render: (r) => r.title }, { label: 'Kind', render: (r) => r.kind }, { label: 'Authority', render: (r) => r.authority ?? '—' }, { label: 'Frequency', render: (r) => r.frequency.toLowerCase() }, { label: 'Owner', render: (r) => r.owner ?? '—' }, { label: 'Next due', render: (r) => fmt(r.nextDue) }, { label: 'Status', render: (r) => r.status.toLowerCase() }]}
      fields={[{ name: 'title', label: 'Title', required: true }, { name: 'kind', label: 'Kind', type: 'select', options: opt(KINDS) }, { name: 'authority', label: 'Authority' }, { name: 'frequency', label: 'Frequency', type: 'select', options: opt(FREQ) }, { name: 'owner', label: 'Owner' }, { name: 'nextDue', label: 'Next due', type: 'date' }, { name: 'status', label: 'Status', type: 'select', options: opt(STATUS) }]}
    />
  );
}
