'use client';
import * as React from 'react';
import { toast } from 'sonner';
import { Search, Zap, ChevronDown, ChevronRight } from 'lucide-react';
import { STARTER_AUTOMATIONS, STARTER_DEPARTMENTS, type StarterAutomation } from '@/config/starter-automations';
import { saveMyAutomation, setMyAutomationsForKeys } from '@/server/actions/my-automations';
import { AUTOMATION_PRIORITIES, type MyAutomationPrefs, type MyAutomationPref } from '@/lib/automation/my-prefs';

const TRIGGER_LABEL: Record<string, string> = {
  LEAD_CREATED: 'When an enquiry arrives', LEAD_STAGE_CHANGED: 'When an enquiry moves stage',
  TASK_CREATED: 'When a task is created', TASK_STATUS_CHANGED: 'When a task changes status', SCHEDULE: 'Every day',
};

function taskParams(a: StarterAutomation): { dueInDays?: number; priority?: string } | null {
  const t = a.actions.find((x) => x.type === 'CREATE_TASK');
  if (!t) return null;
  const p = t.params as { dueInDays?: unknown; priority?: unknown };
  return { dueInDays: typeof p.dueInDays === 'number' ? p.dueInDays : undefined, priority: typeof p.priority === 'string' ? p.priority : undefined };
}

export function MyAutomations({ prefs: initial }: { prefs: MyAutomationPrefs }) {
  const [prefs, setPrefs] = React.useState<MyAutomationPrefs>(initial);
  const [q, setQ] = React.useState('');
  const [openDepts, setOpenDepts] = React.useState<Set<string>>(new Set());
  const [, start] = React.useTransition();

  const onCount = Object.values(prefs).filter((p) => p.on).length;

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    return STARTER_AUTOMATIONS.filter((a) => !needle || a.name.toLowerCase().includes(needle) || a.what.toLowerCase().includes(needle) || a.department.toLowerCase().includes(needle));
  }, [q]);

  const byDept = React.useMemo(() => {
    const m = new Map<string, StarterAutomation[]>();
    for (const a of filtered) { const arr = m.get(a.department) ?? []; arr.push(a); m.set(a.department, arr); }
    return m;
  }, [filtered]);

  const depts = [...STARTER_DEPARTMENTS].filter((d) => byDept.has(d));

  const update = (key: string, patch: Partial<MyAutomationPref>) => {
    const next: MyAutomationPref = { on: prefs[key]?.on ?? false, ...prefs[key], ...patch };
    setPrefs((p) => ({ ...p, [key]: next }));
    start(async () => {
      const r = await saveMyAutomation({ key, on: next.on, dueInDays: next.dueInDays, priority: next.priority });
      if ('error' in r) toast.error(r.error);
    });
  };

  const bulk = (dept: string, on: boolean) => {
    const keys = (byDept.get(dept) ?? []).map((a) => a.key);
    setPrefs((p) => { const n = { ...p }; for (const k of keys) n[k] = { ...(n[k] ?? {}), on }; return n; });
    start(async () => {
      const r = await setMyAutomationsForKeys(keys, on);
      if ('error' in r) toast.error(r.error); else toast.success(`${on ? 'Enabled' : 'Turned off'} ${keys.length} in ${dept}`);
    });
  };

  const toggleDept = (d: string) => setOpenDepts((s) => { const n = new Set(s); n.has(d) ? n.delete(d) : n.add(d); return n; });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-md border bg-card px-2.5 py-1.5 text-sm">
          <Zap className="h-4 w-4 text-[#A07D34]" /><span className="font-semibold">{STARTER_AUTOMATIONS.length}</span> automations · <span className="font-semibold text-emerald-700">{onCount}</span> on for you
        </div>
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search automations…" className="w-full rounded-md border bg-card py-1.5 pl-8 pr-2 text-sm" />
        </div>
      </div>

      {depts.length === 0 && <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No automations match “{q}”.</p>}

      {depts.map((dept) => {
        const list = byDept.get(dept)!;
        const open = openDepts.has(dept) || q.trim().length > 0;
        const onInDept = list.filter((a) => prefs[a.key]?.on).length;
        return (
          <div key={dept} className="overflow-hidden rounded-lg border">
            <div className="flex items-center gap-2 bg-secondary/40 px-3 py-2">
              <button onClick={() => toggleDept(dept)} className="flex flex-1 items-center gap-2 text-left">
                {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <span className="text-sm font-semibold text-[#1B2A4A]">{dept}</span>
                <span className="text-xs text-muted-foreground">{onInDept}/{list.length} on</span>
              </button>
              <button onClick={() => bulk(dept, true)} className="rounded border bg-card px-2 py-0.5 text-xs hover:bg-secondary">All on</button>
              <button onClick={() => bulk(dept, false)} className="rounded border bg-card px-2 py-0.5 text-xs hover:bg-secondary">All off</button>
            </div>
            {open && (
              <ul className="divide-y">
                {list.map((a) => <Row key={a.key} a={a} pref={prefs[a.key]} onUpdate={update} />)}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Row({ a, pref, onUpdate }: { a: StarterAutomation; pref?: MyAutomationPref; onUpdate: (key: string, patch: Partial<MyAutomationPref>) => void }) {
  const on = pref?.on ?? false;
  const params = taskParams(a);
  const dueInDays = pref?.dueInDays ?? params?.dueInDays;
  const priority = pref?.priority ?? params?.priority;
  return (
    <li className="flex items-start gap-3 p-3">
      <button
        onClick={() => onUpdate(a.key, { on: !on })}
        role="switch" aria-checked={on} aria-label={`Turn ${a.name} ${on ? 'off' : 'on'}`}
        className={`mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${on ? 'bg-emerald-500' : 'bg-slate-300'}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${on ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-[#1B2A4A]">{a.name}</span>
          {a.startHere && <span className="rounded bg-[#A07D34]/15 px-1.5 py-0.5 text-[10px] font-medium text-[#7a5f28]">Start here</span>}
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">{TRIGGER_LABEL[a.trigger] ?? a.trigger}</span>
        </div>
        <p className="text-xs text-muted-foreground">{a.what}</p>
        {on && params && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            {params.dueInDays !== undefined && (
              <label className="flex items-center gap-1">Due in
                <input type="number" min={0} max={365} value={dueInDays ?? 0} onChange={(e) => onUpdate(a.key, { dueInDays: Math.max(0, Number(e.target.value) || 0) })} className="w-16 rounded border px-1.5 py-0.5" /> days
              </label>
            )}
            {params.priority !== undefined && (
              <label className="flex items-center gap-1">Priority
                <select value={priority ?? 'MEDIUM'} onChange={(e) => onUpdate(a.key, { priority: e.target.value })} className="rounded border px-1.5 py-0.5">
                  {AUTOMATION_PRIORITIES.map((p) => <option key={p} value={p}>{p[0] + p.slice(1).toLowerCase()}</option>)}
                </select>
              </label>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
