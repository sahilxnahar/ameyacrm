'use client';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { BulkBar, RowCheck } from '@/components/ui/bulk-bar';
import { PriorityBadge, StatusBadge } from './badges';
import { formatDate, initials } from '@/lib/utils/format';
import { bulkUpdateTasks } from '@/server/actions/bulk';
import type { BoardTask } from '@/server/services/task-service';

const sel = 'focus-ring rounded-md border bg-background px-2 py-1.5 text-xs';

export function TaskList({ tasks, people = [] }: { tasks: BoardTask[]; people?: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const [picked, setPicked] = useState<string[]>([]);
  const [pending, start] = useTransition();

  if (tasks.length === 0) {
    return <p className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">No tasks yet. Create your first task.</p>;
  }

  const allOn = picked.length === tasks.length;
  const toggleAll = () => setPicked(allOn ? [] : tasks.map((t) => t.id));
  const toggle = (id: string, on: boolean) =>
    setPicked((p) => (on ? [...p, id] : p.filter((x) => x !== id)));

  const run = (payload: Record<string, unknown>) =>
    start(async () => {
      const res = await bulkUpdateTasks({ ids: picked, ...payload });
      if ('error' in res) { toast.error(res.error); return; }
      toast.success(res.message);
      setPicked([]);
      router.refresh();
    });

  return (
    <>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <RowCheck checked={allOn} onChange={toggleAll} label="Select every task" />
              </TableHead>
              <TableHead>Ref</TableHead><TableHead>Title</TableHead><TableHead>Status</TableHead>
              <TableHead>Priority</TableHead><TableHead>Due</TableHead><TableHead>Assignees</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((t) => {
              const on = picked.includes(t.id);
              return (
                <TableRow key={t.id} className={on ? 'bg-secondary/50' : undefined}>
                  <TableCell><RowCheck checked={on} onChange={(v) => toggle(t.id, v)} label={`Select ${t.reference}`} /></TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{t.reference}</TableCell>
                  <TableCell><Link href={`/tasks/${t.id}`} className="font-medium hover:text-primary">{t.title}</Link></TableCell>
                  <TableCell><StatusBadge status={t.status as never} /></TableCell>
                  <TableCell><PriorityBadge priority={t.priority as never} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(t.dueDate, 'dd MMM yyyy')}</TableCell>
                  <TableCell>
                    <div className="flex -space-x-2">
                      {t.assignees.slice(0, 4).map((a, i) => (
                        <Avatar key={i} className="h-6 w-6 border-2 border-background"><AvatarFallback className="text-[9px]">{initials(a.name)}</AvatarFallback></Avatar>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <BulkBar count={picked.length} onClear={() => setPicked([])} busy={pending}>
        <select className={sel} defaultValue="" disabled={pending}
          onChange={(e) => { if (e.target.value) { run({ action: 'status', status: e.target.value }); e.target.value = ''; } }}>
          <option value="">Set status…</option>
          {['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'BLOCKED', 'DONE'].map((s) => <option key={s} value={s}>{s.replace('_', ' ').toLowerCase()}</option>)}
        </select>

        <select className={sel} defaultValue="" disabled={pending}
          onChange={(e) => { if (e.target.value) { run({ action: 'priority', priority: e.target.value }); e.target.value = ''; } }}>
          <option value="">Set priority…</option>
          {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((s) => <option key={s} value={s}>{s.toLowerCase()}</option>)}
        </select>

        {people.length > 0 && (
          <select className={sel} defaultValue="" disabled={pending}
            onChange={(e) => { if (e.target.value) { run({ action: 'assign', assigneeId: e.target.value }); e.target.value = ''; } }}>
            <option value="">Assign to…</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}

        <input type="date" className={sel} disabled={pending}
          onChange={(e) => { if (e.target.value) run({ action: 'due', dueDate: e.target.value }); }} />
      </BulkBar>
    </>
  );
}
