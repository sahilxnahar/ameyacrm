'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Loader2, Timer, Tag, GitBranch, ListTree } from 'lucide-react';
import { addSubtask, addTaskDependency, setTaskLabels, logTaskTime } from '@/server/actions/tasks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from './badges';
import { titleCase } from '@/lib/utils/format';

interface Ref { id: string; reference: string; title: string; status: string }
interface LabelOpt { id: string; name: string; color: string }

export function TaskManagePanel({ taskId, subtasks, dependencies, candidates, allLabels, currentLabelIds, estimateMins, actualMins }: {
  taskId: string; subtasks: Ref[]; dependencies: Ref[]; candidates: Ref[];
  allLabels: LabelOpt[]; currentLabelIds: string[]; estimateMins: number | null; actualMins: number | null;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [subtitle, setSubtitle] = React.useState('');
  const [labels, setLabels] = React.useState<string[]>(currentLabelIds);
  const [depId, setDepId] = React.useState('');
  const [mins, setMins] = React.useState('');

  const run = (fn: () => Promise<{ ok: true; id: string } | { error: string }>, ok: string, after?: () => void) =>
    start(async () => { const r = await fn(); if ('error' in r) return toast.error(r.error); toast.success(ok); after?.(); router.refresh(); });

  const selectCls = 'flex h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm';

  return (
    <div className="space-y-6">
      {/* Subtasks */}
      <section>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold"><ListTree className="h-4 w-4" /> Subtasks</h3>
        <div className="space-y-1">
          {subtasks.map((s) => (
            <Link key={s.id} href={`/tasks/${s.id}`} className="flex items-center gap-2 rounded-md border p-2 text-sm hover:bg-secondary">
              <span className="font-mono text-[10px] text-muted-foreground">{s.reference}</span>
              <span className="flex-1 truncate">{s.title}</span>
              <StatusBadge status={s.status as never} />
            </Link>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Add a subtask…" />
          <Button size="sm" disabled={pending || subtitle.trim().length < 3} onClick={() => run(() => addSubtask(taskId, subtitle), 'Subtask added', () => setSubtitle(''))}><Plus className="h-4 w-4" /></Button>
        </div>
      </section>

      {/* Labels */}
      <section>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold"><Tag className="h-4 w-4" /> Labels</h3>
        <div className="flex flex-wrap gap-2">
          {allLabels.map((l) => {
            const on = labels.includes(l.id);
            return (
              <button key={l.id} onClick={() => setLabels((p) => on ? p.filter((x) => x !== l.id) : [...p, l.id])}
                className="rounded-full border px-3 py-1 text-xs" style={on ? { borderColor: l.color, color: l.color, background: `${l.color}18` } : {}}>
                {l.name}
              </button>
            );
          })}
        </div>
        <Button size="sm" variant="outline" className="mt-2" disabled={pending} onClick={() => run(() => setTaskLabels(taskId, labels), 'Labels updated')}>Save labels</Button>
      </section>

      {/* Dependencies */}
      <section>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold"><GitBranch className="h-4 w-4" /> Depends on</h3>
        <div className="space-y-1">
          {dependencies.map((d) => (
            <div key={d.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
              <span className="font-mono text-[10px] text-muted-foreground">{d.reference}</span>
              <span className="flex-1 truncate">{d.title}</span>
              <Badge variant="secondary">{titleCase(d.status)}</Badge>
            </div>
          ))}
          {dependencies.length === 0 && <p className="text-xs text-muted-foreground">No dependencies.</p>}
        </div>
        <div className="mt-2 flex gap-2">
          <select className={selectCls} value={depId} onChange={(e) => setDepId(e.target.value)}>
            <option value="">Select a task…</option>
            {candidates.map((c) => <option key={c.id} value={c.id}>{c.reference} · {c.title}</option>)}
          </select>
          <Button size="sm" disabled={pending || !depId} onClick={() => run(() => addTaskDependency(taskId, depId), 'Dependency added', () => setDepId(''))}><Plus className="h-4 w-4" /></Button>
        </div>
      </section>

      {/* Time tracking */}
      <section>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold"><Timer className="h-4 w-4" /> Time</h3>
        <p className="text-sm text-muted-foreground">Estimate: {estimateMins ?? '—'} min · Logged: {actualMins ?? 0} min</p>
        <div className="mt-2 flex gap-2">
          <Input type="number" min={1} value={mins} onChange={(e) => setMins(e.target.value)} placeholder="Log minutes" className="w-36" />
          <Button size="sm" disabled={pending || !mins} onClick={() => run(() => logTaskTime(taskId, Number(mins)), 'Time logged', () => setMins(''))}>Log</Button>
        </div>
      </section>
    </div>
  );
}
