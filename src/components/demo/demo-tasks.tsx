'use client';

import * as React from 'react';
import type { SandboxData } from '@/server/services/sandbox-service';
import { sandboxAddTask, sandboxToggleTask } from '@/server/actions/sandbox';
import { PageHead, ResetButton, useRunner, Empty } from './demo-shared';

export function DemoTasks({ data }: { data: SandboxData }) {
  const [pending, run] = useRunner();
  const [title, setTitle] = React.useState('');
  const [due, setDue] = React.useState('');

  const open = data.tasks.filter((t) => !t.done);
  const done = data.tasks.filter((t) => t.done);
  const today = new Date().toISOString().slice(0, 10);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    run(() => sandboxAddTask(title, due || undefined), 'Task added');
    setTitle(''); setDue('');
  };

  const Row = ({ t }: { t: SandboxData['tasks'][number] }) => {
    const overdue = !t.done && t.dueDate && t.dueDate < today;
    return (
      <li className="flex items-center gap-3 p-2.5">
        <input
          type="checkbox" checked={t.done} disabled={pending}
          aria-label={t.title}
          onChange={(e) => run(() => sandboxToggleTask(t.id, e.target.checked), e.target.checked ? 'Done' : 'Reopened')}
          className="h-4 w-4"
        />
        <span className={`flex-1 text-sm ${t.done ? 'text-muted-foreground line-through' : ''}`}>{t.title}</span>
        {t.dueDate && (
          <span className={`shrink-0 text-xs ${overdue ? 'font-medium text-destructive' : 'text-muted-foreground'}`}>
            {overdue ? 'overdue · ' : ''}{t.dueDate}
          </span>
        )}
      </li>
    );
  };

  return (
    <div>
      <PageHead title="Tasks" blurb="Your follow-ups, site visits and reminders.">
        <ResetButton />
      </PageHead>

      <form onSubmit={submit} className="mb-4 flex flex-wrap gap-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs doing?" className="min-w-[12rem] flex-1 rounded-md border bg-background px-3 py-1.5 text-sm" />
        <input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Due date" className="rounded-md border bg-background px-2 py-1.5 text-sm" />
        <button type="submit" disabled={pending} className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50">Add</button>
      </form>

      {data.tasks.length === 0 ? <Empty>Nothing on the list yet.</Empty> : (
        <>
          <h2 className="mb-1.5 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Open ({open.length})</h2>
          <ul className="divide-y rounded-lg border">
            {open.length === 0 ? <li className="p-4 text-center text-sm text-muted-foreground">All clear.</li> : open.map((t) => <Row key={t.id} t={t} />)}
          </ul>

          {done.length > 0 && (
            <>
              <h2 className="mb-1.5 mt-5 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Done ({done.length})</h2>
              <ul className="divide-y rounded-lg border opacity-70">{done.map((t) => <Row key={t.id} t={t} />)}</ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
