'use client';
import { RegisterScreen } from '@/components/common/register-screen';
import { createDecision } from '@/server/actions/compliance';
const fmt = (d: Date) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
interface Row { id: string; title: string; decidedOn: Date; decidedBy: string | null; decision: string; context: string | null; }
export function KnowledgeRegister({ canManage, projects, projectId, rows }: { canManage: boolean; projects: Array<{ id: string; name: string }>; projectId: string | null; rows: Row[] }) {
  return (
    <RegisterScreen<Row>
      basePath="/knowledge" projects={projects} projectId={projectId} canManage={canManage} rows={rows}
      addLabel="Log a decision" emptyText="No decisions logged. Capture what was decided, when and why — invaluable eighteen months later and impossible to reconstruct."
      onCreate={(v) => createDecision({ ...v, projectId: projectId ?? '' })}
      tiles={[{ label: 'Decisions', value: String(rows.length) }, { label: 'This project', value: String(rows.length) }]}
      columns={[{ label: 'Decision', render: (r) => r.title }, { label: 'Decided', render: (r) => fmt(r.decidedOn) }, { label: 'By', render: (r) => r.decidedBy ?? '—' }, { label: 'What was decided', render: (r) => <span className="text-xs text-muted-foreground">{r.decision.slice(0, 120)}</span> }]}
      fields={[{ name: 'title', label: 'Decision (short)', required: true }, { name: 'decidedBy', label: 'Decided by' }, { name: 'context', label: 'Context / options', type: 'textarea' }, { name: 'decision', label: 'What was decided', type: 'textarea', required: true }]}
    />
  );
}
