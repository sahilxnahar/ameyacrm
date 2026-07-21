'use client';
import { RegisterScreen } from '@/components/common/register-screen';
import { createRisk } from '@/server/actions/compliance';
interface Row { id: string; title: string; category: string | null; likelihood: string; impact: string; owner: string | null; status: string; score: number; band: string; }
const LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const RSTATUS = ['OPEN', 'MITIGATING', 'MONITORED', 'CLOSED'];
const opt = (a: string[]) => a.map((v) => ({ value: v, label: v.toLowerCase() }));
function Band({ band, score }: { band: string; score: number }) {
  const cls = band === 'SEVERE' ? 'bg-destructive/10 text-destructive' : band === 'HIGH' ? 'bg-amber-500/10 text-amber-600' : band === 'MODERATE' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground';
  return <span className={`rounded-full px-2 py-0.5 text-xs ${cls}`}>{score} · {band.toLowerCase()}</span>;
}
export function GovernanceRegister({ canManage, projects, projectId, rows }: { canManage: boolean; projects: Array<{ id: string; name: string }>; projectId: string | null; rows: Row[] }) {
  const severe = rows.filter((r) => r.band === 'SEVERE').length;
  return (
    <RegisterScreen<Row>
      basePath="/governance" projects={projects} projectId={projectId} canManage={canManage} rows={rows}
      addLabel="Raise a risk" emptyText="No risks on the register. Add them with a likelihood and impact so the board sees the right five first."
      onCreate={(v) => createRisk({ ...v, projectId: projectId ?? '' })}
      tiles={[{ label: 'Risks', value: String(rows.length) }, { label: 'Severe', value: String(severe), tone: severe > 0 ? 'bad' : 'default' }, { label: 'Open', value: String(rows.filter((r) => r.status !== 'CLOSED').length) }]}
      columns={[{ label: 'Risk', render: (r) => r.title }, { label: 'Category', render: (r) => r.category ?? '—' }, { label: 'Likelihood', render: (r) => r.likelihood.toLowerCase() }, { label: 'Impact', render: (r) => r.impact.toLowerCase() }, { label: 'Score', render: (r) => <Band band={r.band} score={r.score} /> }, { label: 'Owner', render: (r) => r.owner ?? '—' }, { label: 'Status', render: (r) => r.status.toLowerCase() }]}
      fields={[{ name: 'title', label: 'Risk', required: true }, { name: 'category', label: 'Category', placeholder: 'financial, legal, safety…' }, { name: 'likelihood', label: 'Likelihood', type: 'select', options: opt(LEVELS), defaultValue: 'MEDIUM' }, { name: 'impact', label: 'Impact', type: 'select', options: opt(LEVELS), defaultValue: 'MEDIUM' }, { name: 'owner', label: 'Owner' }, { name: 'status', label: 'Status', type: 'select', options: opt(RSTATUS) }, { name: 'mitigation', label: 'Mitigation', type: 'textarea' }]}
    />
  );
}
