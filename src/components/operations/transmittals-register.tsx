'use client';
import { RegisterScreen } from '@/components/common/register-screen';
import { createTransmittal } from '@/server/actions/operations';
const fmt = (d: Date) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
interface Row { id: string; drawingRef: string; title: string; revision: string | null; issuedTo: string; issuedOn: Date; acknowledged: boolean; }
export function TransmittalsRegister({ canManage, projects, projectId, rows }: { canManage: boolean; projects: Array<{ id: string; name: string }>; projectId: string | null; rows: Row[] }) {
  return <RegisterScreen<Row> basePath="/transmittals" projects={projects} projectId={projectId} canManage={canManage} rows={rows}
    addLabel="Record transmittal" emptyText="No transmittals. Record the formal issue of a drawing to site — the record of who was told what, when, that matters in a dispute."
    onCreate={(v) => createTransmittal({ ...v, projectId: projectId ?? '' })}
    tiles={[{ label: 'Transmittals', value: String(rows.length) }, { label: 'Acknowledged', value: String(rows.filter((r) => r.acknowledged).length) }, { label: 'Awaiting ack', value: String(rows.filter((r) => !r.acknowledged).length) }]}
    columns={[{ label: 'Drawing', render: (r) => r.drawingRef }, { label: 'Title', render: (r) => r.title }, { label: 'Rev', render: (r) => r.revision ?? '—' }, { label: 'Issued to', render: (r) => r.issuedTo }, { label: 'Issued', render: (r) => fmt(r.issuedOn) }, { label: 'Ack', render: (r) => (r.acknowledged ? 'yes' : 'no') }]}
    fields={[{ name: 'drawingRef', label: 'Drawing ref', required: true }, { name: 'title', label: 'Title', required: true }, { name: 'revision', label: 'Revision' }, { name: 'issuedTo', label: 'Issued to', required: true }, { name: 'note', label: 'Note' }]}
  />;
}
