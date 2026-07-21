'use client';
import { RegisterScreen } from '@/components/common/register-screen';
import { createWalkIn } from '@/server/actions/operations';
const fmt = (d: Date) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
interface Row { id: string; name: string; phone: string | null; source: string | null; visitedOn: Date; outcome: string | null; }
export function WalkInsRegister({ canManage, projects, projectId, rows }: { canManage: boolean; projects: Array<{ id: string; name: string }>; projectId: string | null; rows: Row[] }) {
  return <RegisterScreen<Row> basePath="/walk-ins" projects={projects} projectId={projectId} canManage={canManage} rows={rows}
    addLabel="Log walk-in" emptyText="No walk-ins logged. The funnel step where property is actually sold — the least instrumented, now captured."
    onCreate={(v) => createWalkIn({ ...v, projectId: projectId ?? '' })}
    tiles={[{ label: 'Walk-ins', value: String(rows.length) }, { label: 'This project', value: String(rows.length) }]}
    columns={[{ label: 'Name', render: (r) => r.name }, { label: 'Phone', render: (r) => r.phone ?? '—' }, { label: 'Source', render: (r) => r.source ?? '—' }, { label: 'Visited', render: (r) => fmt(r.visitedOn) }, { label: 'Outcome', render: (r) => r.outcome ?? '—' }]}
    fields={[{ name: 'name', label: 'Name', required: true }, { name: 'phone', label: 'Phone', type: 'tel' }, { name: 'source', label: 'Source', placeholder: 'hoarding, portal, referral…', advanced: true }, { name: 'outcome', label: 'Outcome', placeholder: 'interested, booked, walked…', advanced: true }]}
  />;
}
