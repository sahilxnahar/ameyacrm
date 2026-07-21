'use client';

import { useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, X, GitBranch, Activity, AlertTriangle } from 'lucide-react';
import { saveActivity, linkActivities, recordProgress, saveDelay, saveBoqItem } from '@/server/actions/programme';
import type { EvResult } from '@/lib/programme/schedule';
import { cn } from '@/lib/utils/cn';

const inr = (n: number) => n.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const fmtDate = (d: Date | string | null) => d == null ? '—' : new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });

interface Row {
  id: string; name: string; wbsCode: string | null; durationDays: number; percentComplete: number;
  plannedCost: number; actualCost: number; isMilestone: boolean; plannedStart: Date | null; plannedEnd: Date | null;
  earlyStartDate: Date; earlyFinishDate: Date; totalFloat: number; critical: boolean;
}
interface Overview {
  projectId: string | null; hasCycle: boolean; projectStart: Date; projectDurationDays: number;
  rows: Row[]; criticalCount: number; ev: EvResult; overallPercent: number;
  delays: Array<{ id: string; cause: string; responsibility: string; days: number; costImpact: number | null; activityName: string | null; occurredOn: Date | null }>;
  totalDelayDays: number;
  boq: Array<{ id: string; code: string | null; description: string; unit: string | null; quantity: number; rate: number; amount: number }>;
  boqTotal: number;
}
type Tab = 'schedule' | 'earned' | 'boq' | 'delays';
type Res = { ok: true; message: string; id?: string } | { error: string };

const inputCls = 'focus-ring mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm';
const primaryBtn = 'focus-ring inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60';

export function ProgrammeView({ canManage, projects, projectId, activities, overview }: {
  canManage: boolean;
  projects: Array<{ id: string; name: string }>;
  projectId: string | null;
  activities: Array<{ id: string; name: string }>;
  overview: Overview;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('schedule');
  const [msg, setMsg] = useState<{ bad: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [openForm, setOpenForm] = useState<string | null>(null);

  const run = (fn: () => Promise<Res>) => start(async () => {
    const r = await fn();
    setMsg('error' in r ? { bad: true, text: r.error } : { bad: false, text: r.message });
    if (!('error' in r)) { setOpenForm(null); router.refresh(); }
  });

  const ev = overview.ev;
  const totalStart = overview.projectStart.getTime();
  const span = Math.max(1, overview.projectDurationDays);

  return (
    <div className="space-y-4">
      {projects.length > 1 && (
        <div className="chip-row">
          {projects.map((p) => (
            <a key={p.id} href={`/programme?project=${p.id}`} className={cn('focus-ring shrink-0 rounded-full border px-3 py-1 text-xs font-medium', p.id === projectId ? 'border-primary bg-primary/10 text-primary' : 'border-border')}>{p.name}</a>
          ))}
        </div>
      )}

      {overview.hasCycle && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" /> The dependencies contain a loop, so no schedule can be computed. Remove a circular link to fix it.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Tile label="Overall" value={`${overview.overallPercent}%`} sub={`${overview.rows.length} activities`} />
        <Tile label="Duration" value={`${overview.projectDurationDays}d`} sub={`${overview.criticalCount} on critical path`} />
        <Tile label="Schedule (SPI)" value={ev.schedulePerformanceIndex.toFixed(2)} sub={ev.schedulePerformanceIndex < 1 ? 'behind' : 'on/ahead'} bad={ev.schedulePerformanceIndex > 0 && ev.schedulePerformanceIndex < 1} />
        <Tile label="Cost (CPI)" value={ev.costPerformanceIndex.toFixed(2)} sub={ev.costPerformanceIndex > 0 && ev.costPerformanceIndex < 1 ? 'over cost' : 'on/under'} bad={ev.costPerformanceIndex > 0 && ev.costPerformanceIndex < 1} />
        <Tile label="Delays" value={`${overview.totalDelayDays}d`} sub={`${overview.delays.length} on record`} bad={overview.totalDelayDays > 0} />
      </div>

      <div className="flex gap-1 border-b border-border">
        {(['schedule', 'earned', 'boq', 'delays'] as Tab[]).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={cn('focus-ring -mb-px border-b-2 px-3 py-2 text-sm font-medium capitalize', tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground')}>
            {t === 'earned' ? 'Earned Value' : t === 'boq' ? 'BOQ' : t}
          </button>
        ))}
      </div>

      {msg && <p className={cn('text-sm', msg.bad ? 'text-destructive' : 'text-emerald-600')}>{msg.text}</p>}

      {tab === 'schedule' && (
        <div className="space-y-3">
          {canManage && projectId && (
            <div className="flex flex-wrap gap-2">
              <AddBtn open={openForm === 'act'} onClick={() => setOpenForm(openForm === 'act' ? null : 'act')} label="Add activity" />
              {activities.length >= 2 && <AddBtn open={openForm === 'link'} onClick={() => setOpenForm(openForm === 'link' ? null : 'link')} label="Link dependency" icon={<GitBranch className="h-4 w-4" />} />}
            </div>
          )}
          {openForm === 'act' && canManage && projectId && (
            <form className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-3" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run(() => saveActivity({ projectId, name: f.get('name') as string, wbsCode: (f.get('wbsCode') as string) || null, durationDays: Number(f.get('durationDays') || 1), plannedStart: (f.get('plannedStart') as string) || null, plannedEnd: (f.get('plannedEnd') as string) || null, plannedCost: f.get('plannedCost') ? Number(f.get('plannedCost')) : 0, isMilestone: f.get('isMilestone') === 'on' })); }}>
              <Field label="Activity *"><input name="name" required className={inputCls} /></Field>
              <Field label="WBS code"><input name="wbsCode" className={inputCls} /></Field>
              <Field label="Duration (days) *"><input name="durationDays" type="number" min="1" defaultValue="1" required className={inputCls} /></Field>
              <Field label="Planned start"><input name="plannedStart" type="date" className={inputCls} /></Field>
              <Field label="Planned end"><input name="plannedEnd" type="date" className={inputCls} /></Field>
              <Field label="Planned cost (₹)"><input name="plannedCost" type="number" step="1" className={inputCls} /></Field>
              <label className="flex items-center gap-2 text-xs"><input name="isMilestone" type="checkbox" /> Milestone</label>
              <div className="sm:col-span-3"><button type="submit" disabled={pending} className={primaryBtn}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Save activity</button></div>
            </form>
          )}
          {openForm === 'link' && canManage && (
            <form className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-3" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run(() => linkActivities({ predecessorId: f.get('predecessorId') as string, successorId: f.get('successorId') as string, lagDays: Number(f.get('lagDays') || 0) })); }}>
              <Field label="Predecessor (finishes first)"><select name="predecessorId" className={inputCls}>{activities.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
              <Field label="Successor (starts after)"><select name="successorId" className={inputCls}>{activities.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
              <Field label="Lag (days)"><input name="lagDays" type="number" defaultValue="0" className={inputCls} /></Field>
              <div className="sm:col-span-3"><button type="submit" disabled={pending} className={primaryBtn}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Save link</button></div>
            </form>
          )}

          {overview.rows.length === 0 ? (
            <Empty text="No activities yet. Add them, then link the dependencies to see the critical path." />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr className="text-left"><th className="p-2">Activity</th><th className="p-2">Start→Finish</th><th className="p-2 w-[30%]">Timeline</th><th className="p-2">Float</th><th className="p-2">%</th></tr>
                </thead>
                <tbody>
                  {overview.rows.map((r) => {
                    const left = ((r.earlyStartDate.getTime() - totalStart) / 86400000 / span) * 100;
                    const width = Math.max(2, ((r.earlyFinishDate.getTime() - r.earlyStartDate.getTime()) / 86400000 / span) * 100);
                    return (
                      <tr key={r.id} className="border-t border-border">
                        <td className="p-2">{r.critical && <span className="mr-1 text-destructive">●</span>}{r.isMilestone ? '◆ ' : ''}{r.name}{r.wbsCode ? <span className="ml-1 text-xs text-muted-foreground">{r.wbsCode}</span> : ''}</td>
                        <td className="p-2 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(r.earlyStartDate)} → {fmtDate(r.earlyFinishDate)}</td>
                        <td className="p-2">
                          <div className="relative h-3 w-full rounded bg-muted">
                            <div className={cn('absolute h-3 rounded', r.critical ? 'bg-destructive' : 'bg-primary')} style={{ left: `${Math.max(0, Math.min(98, left))}%`, width: `${Math.min(100, width)}%` }} />
                            <div className="absolute h-3 rounded bg-emerald-500/70" style={{ left: `${Math.max(0, Math.min(98, left))}%`, width: `${Math.min(width, width * (r.percentComplete / 100))}%` }} />
                          </div>
                        </td>
                        <td className="p-2 text-xs">{r.critical ? <span className="text-destructive">0 (critical)</span> : `${r.totalFloat}d`}</td>
                        <td className="p-2">
                          {canManage ? (
                            <button type="button" onClick={() => setOpenForm(openForm === `prog-${r.id}` ? null : `prog-${r.id}`)} className="text-xs text-primary hover:underline">{r.percentComplete}%</button>
                          ) : `${r.percentComplete}%`}
                          {openForm === `prog-${r.id}` && canManage && (
                            <form className="mt-1 flex gap-1" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run(() => recordProgress({ activityId: r.id, percentComplete: Number(f.get('pc')), note: (f.get('note') as string) || null })); }}>
                              <input name="pc" type="number" min="0" max="100" defaultValue={r.percentComplete} className={cn(inputCls, 'w-16 mt-0')} />
                              <input name="note" placeholder="note" className={cn(inputCls, 'w-24 mt-0')} />
                              <button type="submit" disabled={pending} className="focus-ring rounded bg-primary px-2 text-xs text-primary-foreground">✓</button>
                            </form>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-muted-foreground"><span className="text-destructive">●</span> critical (zero float). Green fill is measured progress. Dates are computed from durations and dependencies against the earliest planned start.</p>
        </div>
      )}

      {tab === 'earned' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label="Budget (BAC)" value={inr(ev.budgetAtCompletion)} sub="planned total" />
            <Tile label="Earned (EV)" value={inr(ev.earnedValue)} sub="value of work done" />
            <Tile label="Actual (AC)" value={inr(ev.actualCost)} sub="spent so far" />
            <Tile label="Planned (PV)" value={inr(ev.plannedValue)} sub="should be done by now" />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border p-3">
              <div className="text-xs text-muted-foreground">Schedule variance (EV − PV)</div>
              <div className={cn('mt-1 font-display text-xl font-semibold', ev.scheduleVariance < 0 ? 'text-destructive' : 'text-emerald-600')}>{inr(ev.scheduleVariance)}</div>
              <div className="text-xs text-muted-foreground">{ev.scheduleVariance < 0 ? 'behind schedule' : 'on or ahead of schedule'}</div>
            </div>
            <div className="rounded-lg border border-border p-3">
              <div className="text-xs text-muted-foreground">Cost variance (EV − AC)</div>
              <div className={cn('mt-1 font-display text-xl font-semibold', ev.costVariance < 0 ? 'text-destructive' : 'text-emerald-600')}>{inr(ev.costVariance)}</div>
              <div className="text-xs text-muted-foreground">{ev.costVariance < 0 ? 'over cost' : 'on or under cost'}</div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Earned value compares the value of work actually done (EV) against what was planned by now (PV) and what it cost (AC). SPI and CPI below 1.00 are the early warning.</p>
        </div>
      )}

      {tab === 'boq' && (
        <BoqTab boq={overview.boq} total={overview.boqTotal} canManage={canManage} projectId={projectId} pending={pending} openForm={openForm} setOpenForm={setOpenForm} run={run} />
      )}

      {tab === 'delays' && (
        <DelaysTab delays={overview.delays} activities={activities} canManage={canManage} projectId={projectId} pending={pending} openForm={openForm} setOpenForm={setOpenForm} run={run} />
      )}
    </div>
  );
}

function Tile({ label, value, sub, bad }: { label: string; value: string; sub: string; bad?: boolean }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn('mt-1 font-display text-xl font-semibold', bad ? 'text-destructive' : '')}>{value}</div>
      <div className="text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block text-xs"><span className="text-muted-foreground">{label}</span>{children}</label>; }
function AddBtn({ open, onClick, label, icon }: { open: boolean; onClick: () => void; label: string; icon?: ReactNode }) {
  return <button type="button" onClick={onClick} className="focus-ring inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium">{open ? <X className="h-4 w-4" /> : (icon ?? <Plus className="h-4 w-4" />)}{open ? 'Close' : label}</button>;
}
function Empty({ text }: { text: string }) { return <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{text}</div>; }

type RunFn = (fn: () => Promise<Res>) => void;

function BoqTab({ boq, total, canManage, projectId, pending, openForm, setOpenForm, run }: { boq: Overview['boq']; total: number; canManage: boolean; projectId: string | null; pending: boolean; openForm: string | null; setOpenForm: (v: string | null) => void; run: RunFn }) {
  return (
    <div className="space-y-3">
      {canManage && projectId && <AddBtn open={openForm === 'boq'} onClick={() => setOpenForm(openForm === 'boq' ? null : 'boq')} label="Add BOQ item" />}
      {openForm === 'boq' && canManage && projectId && (
        <form className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-3" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run(() => saveBoqItem({ projectId, code: (f.get('code') as string) || null, description: f.get('description') as string, unit: (f.get('unit') as string) || null, quantity: Number(f.get('quantity') || 0), rate: Number(f.get('rate') || 0) })); }}>
          <Field label="Code"><input name="code" className={inputCls} /></Field>
          <Field label="Description *"><input name="description" required className={inputCls} /></Field>
          <Field label="Unit"><input name="unit" placeholder="cft, tonnes, nos" className={inputCls} /></Field>
          <Field label="Quantity"><input name="quantity" type="number" step="0.001" className={inputCls} /></Field>
          <Field label="Rate (₹)"><input name="rate" type="number" step="0.01" className={inputCls} /></Field>
          <div className="sm:col-span-3"><button type="submit" disabled={pending} className={primaryBtn}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Save item</button></div>
        </form>
      )}
      {boq.length === 0 ? <Empty text="No bill of quantities yet." /> : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground"><tr className="text-left"><th className="p-2">Code</th><th className="p-2">Description</th><th className="p-2">Qty</th><th className="p-2">Unit</th><th className="p-2">Rate</th><th className="p-2">Amount</th></tr></thead>
            <tbody>
              {boq.map((b) => <tr key={b.id} className="border-t border-border"><td className="p-2 text-xs">{b.code ?? '—'}</td><td className="p-2">{b.description}</td><td className="p-2">{b.quantity}</td><td className="p-2 text-xs">{b.unit ?? '—'}</td><td className="p-2">{inr(b.rate)}</td><td className="p-2 font-medium">{inr(b.amount)}</td></tr>)}
              <tr className="border-t border-border font-medium"><td className="p-2" colSpan={5}>Total</td><td className="p-2">{inr(total)}</td></tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DelaysTab({ delays, activities, canManage, projectId, pending, openForm, setOpenForm, run }: { delays: Overview['delays']; activities: Array<{ id: string; name: string }>; canManage: boolean; projectId: string | null; pending: boolean; openForm: string | null; setOpenForm: (v: string | null) => void; run: RunFn }) {
  return (
    <div className="space-y-3">
      {canManage && projectId && <AddBtn open={openForm === 'delay'} onClick={() => setOpenForm(openForm === 'delay' ? null : 'delay')} label="Record delay" icon={<Activity className="h-4 w-4" />} />}
      {openForm === 'delay' && canManage && projectId && (
        <form className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-3" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run(() => saveDelay({ projectId, activityId: (f.get('activityId') as string) || null, cause: f.get('cause') as string, responsibility: (f.get('responsibility') as string) as never, days: Number(f.get('days') || 0), costImpact: f.get('costImpact') ? Number(f.get('costImpact')) : null, occurredOn: (f.get('occurredOn') as string) || null })); }}>
          <Field label="Cause *"><input name="cause" required className={inputCls} /></Field>
          <Field label="Responsibility"><select name="responsibility" defaultValue="CONTRACTOR" className={inputCls}>{['DEVELOPER', 'CONTRACTOR', 'CONSULTANT', 'AUTHORITY', 'FORCE_MAJEURE', 'OTHER'].map((v) => <option key={v} value={v}>{v.replace(/_/g, ' ').toLowerCase()}</option>)}</select></Field>
          <Field label="Days"><input name="days" type="number" min="0" className={inputCls} /></Field>
          <Field label="Cost impact (₹)"><input name="costImpact" type="number" step="1" className={inputCls} /></Field>
          <Field label="Occurred on"><input name="occurredOn" type="date" className={inputCls} /></Field>
          <Field label="Activity (optional)"><select name="activityId" defaultValue="" className={inputCls}><option value="">— none —</option>{activities.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
          <div className="sm:col-span-3"><button type="submit" disabled={pending} className={primaryBtn}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Record delay</button></div>
        </form>
      )}
      {delays.length === 0 ? <Empty text="No delays recorded. A cause captured now is worth a great deal in a dispute later." /> : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground"><tr className="text-left"><th className="p-2">Cause</th><th className="p-2">Responsibility</th><th className="p-2">Activity</th><th className="p-2">Days</th><th className="p-2">Cost</th><th className="p-2">When</th></tr></thead>
            <tbody>
              {delays.map((d) => <tr key={d.id} className="border-t border-border"><td className="p-2">{d.cause}</td><td className="p-2 text-xs capitalize">{d.responsibility.replace(/_/g, ' ').toLowerCase()}</td><td className="p-2 text-xs">{d.activityName ?? '—'}</td><td className="p-2">{d.days}d</td><td className="p-2">{d.costImpact != null ? inr(d.costImpact) : '—'}</td><td className="p-2 text-xs">{fmtDate(d.occurredOn)}</td></tr>)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
