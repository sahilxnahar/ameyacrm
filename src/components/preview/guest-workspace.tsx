'use client';

import * as React from 'react';
import { toast } from 'sonner';
import {
  Users2, Building2, IndianRupee, CheckCircle2, Plus, Trash2, RotateCcw,
  BookOpen, ListTodo, StickyNote, Info,
} from 'lucide-react';
import type { SandboxData } from '@/server/services/sandbox-service';
import {
  sandboxAddLead, sandboxSetLeadStatus, sandboxDeleteLead, sandboxAddTask,
  sandboxToggleTask, sandboxSetUnitStatus, sandboxAddEntry, sandboxAddNote, sandboxReset,
} from '@/server/actions/sandbox';

/**
 * The guest workspace — a fully interactive demo.
 *
 * Everything here reads and writes the caller's own sandbox tables, so a guest
 * gets the real feel of the product (add a lead, move it along, hold a flat,
 * post a journal entry) with no path to company data.
 */

const inr = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const crore = (n: number) => (n >= 10000000 ? `₹${(n / 10000000).toFixed(2)} Cr` : inr(n));

const LEAD_STATUSES = ['NEW', 'QUALIFIED', 'SITE_VISIT', 'NEGOTIATION', 'BOOKED', 'LOST'] as const;
const UNIT_STATUSES = ['AVAILABLE', 'HELD', 'BOOKED'] as const;
const ACCOUNTS = ['Bank', 'Cash', 'Advance from Customers', 'Material Purchase', 'Sundry Creditors', 'Construction WIP', 'Marketing Expense', 'Salaries'];

type Tab = 'leads' | 'inventory' | 'tasks' | 'books' | 'notes';

export function GuestWorkspace({ data }: { data: SandboxData }) {
  const [tab, setTab] = React.useState<Tab>('leads');
  const [pending, start] = React.useTransition();

  const run = (fn: () => Promise<{ ok: true } | { error: string }>, okMsg: string) =>
    start(async () => {
      const r = await fn();
      if ('error' in r) { toast.error(r.error); return; }
      toast.success(okMsg);
    });

  const expiresIn = React.useMemo(() => {
    const ms = new Date(data.expiresAt).getTime() - Date.now();
    if (ms <= 0) return 'shortly';
    const h = Math.floor(ms / 3600_000);
    return h >= 1 ? `in about ${h} hour${h === 1 ? '' : 's'}` : 'in under an hour';
  }, [data.expiresAt]);

  const TABS: Array<{ key: Tab; label: string; Icon: typeof Users2; n: number }> = [
    { key: 'leads', label: 'Leads', Icon: Users2, n: data.leads.length },
    { key: 'inventory', label: 'Inventory', Icon: Building2, n: data.units.length },
    { key: 'tasks', label: 'Tasks', Icon: ListTodo, n: data.tasks.filter((t) => !t.done).length },
    { key: 'books', label: 'Books', Icon: BookOpen, n: data.entries.length },
    { key: 'notes', label: 'Notes', Icon: StickyNote, n: data.notes.length },
  ];

  return (
    <div className="space-y-5">
      {/* What this is */}
      <div className="flex flex-wrap items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="min-w-[16rem] flex-1">
          <p className="text-sm font-semibold">This is your own demo workspace</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Every record here is invented, and it is yours alone — no other guest can see it and none of it
            touches real company data. Add, edit and delete as much as you like. It resets {expiresIn}.
          </p>
        </div>
        <button
          type="button" disabled={pending}
          onClick={() => run(sandboxReset, 'Workspace reset to the starting demo')}
          className="focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-sm hover:bg-secondary disabled:opacity-50"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Reset
        </button>
      </div>

      {/* Headline numbers, computed from the sandbox */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Leads in play" value={String(data.totals.leads)} Icon={Users2} tone="text-rose-500" />
        <Kpi label="Flats available" value={`${data.totals.available} / ${data.totals.units}`} Icon={Building2} tone="text-blue-500" />
        <Kpi label="Pipeline value" value={crore(data.totals.pipelineValue)} Icon={IndianRupee} tone="text-emerald-500" />
        <Kpi label="Received to bank" value={crore(data.totals.collected)} Icon={CheckCircle2} tone="text-amber-500" />
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b">
        {TABS.map(({ key, label, Icon, n }) => (
          <button
            key={key} type="button" onClick={() => setTab(key)}
            className={`focus-ring -mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              tab === key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
            <span className="rounded-full bg-secondary px-1.5 text-[11px]">{n}</span>
          </button>
        ))}
      </div>

      {tab === 'leads' && <LeadsTab data={data} pending={pending} run={run} />}
      {tab === 'inventory' && <InventoryTab data={data} pending={pending} run={run} />}
      {tab === 'tasks' && <TasksTab data={data} pending={pending} run={run} />}
      {tab === 'books' && <BooksTab data={data} pending={pending} run={run} />}
      {tab === 'notes' && <NotesTab data={data} pending={pending} run={run} />}
    </div>
  );
}

type Runner = (fn: () => Promise<{ ok: true } | { error: string }>, okMsg: string) => void;
interface TabProps { data: SandboxData; pending: boolean; run: Runner }

function Kpi({ label, value, Icon, tone }: { label: string; value: string; Icon: typeof Users2; tone: string }) {
  return (
    <div className="card-elevated rounded-lg border bg-background p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{label}</p>
        <Icon className={`h-4 w-4 ${tone}`} />
      </div>
      <p className="mt-1 font-display text-xl">{value}</p>
    </div>
  );
}

function LeadsTab({ data, pending, run }: TabProps) {
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({ name: '', phone: '', source: 'Walk-in', budget: '', note: '' });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run(() => sandboxAddLead({ ...form, budget: form.budget ? Number(form.budget) : undefined }), 'Lead added');
    setForm({ name: '', phone: '', source: 'Walk-in', budget: '', note: '' });
    setOpen(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button type="button" onClick={() => setOpen((v) => !v)} className="focus-ring inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">
          <Plus className="h-4 w-4" /> Add a lead
        </button>
      </div>

      {open && (
        <form onSubmit={submit} className="grid gap-2 rounded-lg border bg-secondary/30 p-3 sm:grid-cols-2 lg:grid-cols-5">
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name" className="rounded-md border bg-background px-2 py-1.5 text-sm" />
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone" className="rounded-md border bg-background px-2 py-1.5 text-sm" />
          <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} className="rounded-md border bg-background px-2 py-1.5 text-sm">
            {['Walk-in', 'Website', 'Referral', 'Portal', 'Campaign'].map((s) => <option key={s}>{s}</option>)}
          </select>
          <input value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} placeholder="Budget ₹" inputMode="numeric" className="rounded-md border bg-background px-2 py-1.5 text-sm" />
          <button type="submit" disabled={pending} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50">Save</button>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr><th className="p-2">Name</th><th className="p-2">Source</th><th className="p-2">Budget</th><th className="p-2">Stage</th><th className="p-2 text-right">Remove</th></tr>
          </thead>
          <tbody>
            {data.leads.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No leads yet — add one above.</td></tr>}
            {data.leads.map((l) => (
              <tr key={l.id} className="border-t">
                <td className="p-2">
                  <p className="font-medium">{l.name}</p>
                  {l.note && <p className="text-xs text-muted-foreground">{l.note}</p>}
                </td>
                <td className="p-2 text-muted-foreground">{l.source}</td>
                <td className="p-2">{l.budget ? inr(l.budget) : '—'}</td>
                <td className="p-2">
                  <select
                    value={l.status} disabled={pending}
                    onChange={(e) => run(() => sandboxSetLeadStatus(l.id, e.target.value), 'Stage updated')}
                    className="rounded border bg-background px-1.5 py-1 text-xs"
                  >
                    {LEAD_STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                  </select>
                </td>
                <td className="p-2 text-right">
                  <button type="button" disabled={pending} onClick={() => run(() => sandboxDeleteLead(l.id), 'Lead removed')} aria-label={`Remove ${l.name}`} className="focus-ring rounded p-1 text-muted-foreground hover:bg-secondary hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InventoryTab({ data, pending, run }: TabProps) {
  const tone = (s: string) => s === 'AVAILABLE' ? 'bg-emerald-500/15 text-emerald-600' : s === 'HELD' ? 'bg-amber-500/15 text-amber-600' : 'bg-rose-500/15 text-rose-600';
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {data.units.map((u) => (
        <div key={u.id} className="rounded-lg border bg-background p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-medium">{u.number}</p>
              <p className="text-xs text-muted-foreground">{u.tower} · {u.typology} · {u.areaSqft} sq ft</p>
            </div>
            <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${tone(u.status)}`}>{u.status}</span>
          </div>
          <p className="mt-2 font-display">{inr(u.price)}</p>
          <div className="mt-2 flex gap-1">
            {UNIT_STATUSES.map((s) => (
              <button
                key={s} type="button" disabled={pending || u.status === s}
                onClick={() => run(() => sandboxSetUnitStatus(u.id, s), `${u.number} → ${s.toLowerCase()}`)}
                className="focus-ring flex-1 rounded border px-1.5 py-1 text-[11px] hover:bg-secondary disabled:opacity-40"
              >
                {s === 'AVAILABLE' ? 'Free' : s === 'HELD' ? 'Hold' : 'Book'}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TasksTab({ data, pending, run }: TabProps) {
  const [title, setTitle] = React.useState('');
  return (
    <div className="space-y-3">
      <form
        onSubmit={(e) => { e.preventDefault(); if (!title.trim()) return; run(() => sandboxAddTask(title), 'Task added'); setTitle(''); }}
        className="flex gap-2"
      >
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add a task…" className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm" />
        <button type="submit" disabled={pending} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50">Add</button>
      </form>
      <ul className="divide-y rounded-lg border">
        {data.tasks.map((t) => (
          <li key={t.id} className="flex items-center gap-3 p-2.5">
            <input
              type="checkbox" checked={t.done} disabled={pending}
              onChange={(e) => run(() => sandboxToggleTask(t.id, e.target.checked), e.target.checked ? 'Done' : 'Reopened')}
              className="h-4 w-4"
            />
            <span className={`flex-1 text-sm ${t.done ? 'text-muted-foreground line-through' : ''}`}>{t.title}</span>
            {t.dueDate && <span className="text-xs text-muted-foreground">{t.dueDate}</span>}
          </li>
        ))}
        {data.tasks.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">Nothing on the list.</li>}
      </ul>
    </div>
  );
}

function BooksTab({ data, pending, run }: TabProps) {
  const [f, setF] = React.useState({ narration: '', debitAcc: 'Bank', creditAcc: 'Advance from Customers', amount: '' });
  const totalDr = data.entries.reduce((s, e) => s + e.amount, 0);
  return (
    <div className="space-y-3">
      <form
        onSubmit={(e) => { e.preventDefault(); run(() => sandboxAddEntry(f), 'Entry posted'); setF({ ...f, narration: '', amount: '' }); }}
        className="grid gap-2 rounded-lg border bg-secondary/30 p-3 sm:grid-cols-2 lg:grid-cols-5"
      >
        <input required value={f.narration} onChange={(e) => setF({ ...f, narration: e.target.value })} placeholder="What is this for?" className="rounded-md border bg-background px-2 py-1.5 text-sm lg:col-span-2" />
        <select value={f.debitAcc} onChange={(e) => setF({ ...f, debitAcc: e.target.value })} className="rounded-md border bg-background px-2 py-1.5 text-sm">
          {ACCOUNTS.map((a) => <option key={a}>{a}</option>)}
        </select>
        <select value={f.creditAcc} onChange={(e) => setF({ ...f, creditAcc: e.target.value })} className="rounded-md border bg-background px-2 py-1.5 text-sm">
          {ACCOUNTS.map((a) => <option key={a}>{a}</option>)}
        </select>
        <div className="flex gap-2">
          <input required value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} placeholder="₹" inputMode="numeric" className="w-full rounded-md border bg-background px-2 py-1.5 text-sm" />
          <button type="submit" disabled={pending} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50">Post</button>
        </div>
        <p className="text-[11px] text-muted-foreground lg:col-span-5">
          Double entry: the debit account receives the value, the credit account gives it up. Both sides always match.
        </p>
      </form>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr><th className="p-2">Date</th><th className="p-2">Narration</th><th className="p-2">Debit</th><th className="p-2">Credit</th><th className="p-2 text-right">Amount</th></tr>
          </thead>
          <tbody>
            {data.entries.map((e) => (
              <tr key={e.id} className="border-t">
                <td className="p-2 text-muted-foreground">{e.date}</td>
                <td className="p-2">{e.narration}</td>
                <td className="p-2 text-xs">{e.debitAcc}</td>
                <td className="p-2 text-xs">{e.creditAcc}</td>
                <td className="p-2 text-right font-medium">{inr(e.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t bg-secondary/30 font-medium">
              <td className="p-2" colSpan={4}>Total posted</td>
              <td className="p-2 text-right">{inr(totalDr)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function NotesTab({ data, pending, run }: TabProps) {
  const [body, setBody] = React.useState('');
  return (
    <div className="space-y-3">
      <form onSubmit={(e) => { e.preventDefault(); if (!body.trim()) return; run(() => sandboxAddNote(body), 'Note saved'); setBody(''); }} className="space-y-2">
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="Jot something down…" className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
        <button type="submit" disabled={pending} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50">Save note</button>
      </form>
      <ul className="space-y-2">
        {data.notes.map((n) => (
          <li key={n.id} className="rounded-lg border bg-background p-3 text-sm">
            <p>{n.body}</p>
            <p className="mt-1 text-xs text-muted-foreground">{new Date(n.createdAt).toLocaleString('en-IN')}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
