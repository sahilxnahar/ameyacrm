'use client';
import { RegisterScreen } from '@/components/common/register-screen';
import { createIncident } from '@/server/actions/compliance';
const fmt = (d: Date) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
interface Row { id: string; title: string; severity: string; kind: string | null; detectedOn: Date; status: string; }
const SEV = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const IST = ['OPEN', 'INVESTIGATING', 'CONTAINED', 'RESOLVED'];
const opt = (a: string[]) => a.map((v) => ({ value: v, label: v.toLowerCase() }));
export function SecopsRegister({ canManage, rows }: { canManage: boolean; rows: Row[] }) {
  const open = rows.filter((r) => r.status !== 'RESOLVED').length;
  return (
    <RegisterScreen<Row>
      basePath="/security-ops" canManage={canManage} rows={rows}
      addLabel="Log incident" emptyText="No security incidents logged. Record anomalous access, a suspected breach or a near-miss — detection is what controls miss."
      onCreate={(v) => createIncident(v)}
      tiles={[{ label: 'Incidents', value: String(rows.length) }, { label: 'Open', value: String(open), tone: open > 0 ? 'bad' : 'good' }, { label: 'Critical', value: String(rows.filter((r) => r.severity === 'CRITICAL').length), tone: 'bad' }]}
      columns={[{ label: 'Incident', render: (r) => r.title }, { label: 'Severity', render: (r) => <span className={r.severity === 'CRITICAL' || r.severity === 'HIGH' ? 'text-destructive' : 'text-muted-foreground'}>{r.severity.toLowerCase()}</span> }, { label: 'Kind', render: (r) => r.kind ?? '—' }, { label: 'Detected', render: (r) => fmt(r.detectedOn) }, { label: 'Status', render: (r) => r.status.toLowerCase() }]}
      fields={[{ name: 'title', label: 'Incident', required: true }, { name: 'severity', label: 'Severity', type: 'select', options: opt(SEV), defaultValue: 'MEDIUM' }, { name: 'kind', label: 'Kind', placeholder: 'access, export, phishing…' }, { name: 'status', label: 'Status', type: 'select', options: opt(IST) }, { name: 'rootCause', label: 'Root cause', type: 'textarea' }]}
    />
  );
}
