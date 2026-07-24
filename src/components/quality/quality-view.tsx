'use client';

import { useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, X, ShieldCheck, ShieldAlert, HardHat, ClipboardCheck } from 'lucide-react';
import {
  saveInspection, setInspectionResult, saveNcr, advanceNcr, saveSafetyRecord, saveWorkPermit, closeWorkPermit,
} from '@/server/actions/quality';
import { cn } from '@/lib/utils/cn';

const inr = (n: number | null) => n == null ? '—' : n.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const fmtDate = (d: Date | string | null) => d == null ? '—' : new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });

interface Overview {
  inspections: Array<{ id: string; title: string; discipline: string | null; isHoldPoint: boolean; status: string; inspectedBy: string | null; inspectedOn: Date | null; activityId: string | null; itemCount: number; passedItems: number }>;
  ncrs: Array<{ id: string; title: string; severity: string; status: string; assignedTo: string | null; costImpact: number | null; raisedOn: Date; closedOn: Date | null }>;
  permits: Array<{ id: string; type: string; status: string; issuedTo: string; location: string | null; validFrom: Date | null; validTo: Date | null; expired: boolean }>;
  safety: Array<{ id: string; kind: string; severity: string; description: string; rootCause: string | null; personsAffected: number; occurredOn: Date }>;
  safetySummary: { incidents: number; nearMisses: number; toolboxTalks: number; daysSinceLastIncident: number | null };
  openHoldPoints: number; failedHoldPoints: number; openNcrs: number; openPermits: number; expiredPermits: number;
}
type Tab = 'inspections' | 'ncr' | 'safety' | 'permits';
type Res = { ok: true; message: string; id?: string } | { error: string };

const inputCls = 'focus-ring mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm';
const primaryBtn = 'focus-ring inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60';

export function QualityView({ canManage, projects, projectId, overview }: {
  canManage: boolean; projects: Array<{ id: string; name: string }>; projectId: string | null; overview: Overview;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('inspections');
  const [msg, setMsg] = useState<{ bad: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [openForm, setOpenForm] = useState<string | null>(null);

  const run = (fn: () => Promise<Res>) => start(async () => {
    const r = await fn();
    setMsg('error' in r ? { bad: true, text: r.error } : { bad: false, text: r.message });
    if (!('error' in r)) { setOpenForm(null); router.refresh(); }
  });

  const s = overview.safetySummary;

  return (
    <div className="space-y-4">
      {projects.length > 1 && (
        <div className="chip-row">
          {projects.map((p) => (
            <a key={p.id} href={`/quality?project=${p.id}`} className={cn('focus-ring shrink-0 rounded-full border px-3 py-1 text-xs font-medium', p.id === projectId ? 'border-primary bg-primary/10 text-primary' : 'border-border')}>{p.name}</a>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Tile icon={<ShieldAlert className="h-4 w-4" />} label="Hold points open" value={String(overview.openHoldPoints + overview.failedHoldPoints)} sub={overview.failedHoldPoints ? `${overview.failedHoldPoints} failed` : 'awaiting pass'} bad={overview.openHoldPoints + overview.failedHoldPoints > 0} />
        <Tile icon={<ClipboardCheck className="h-4 w-4" />} label="Open NCRs" value={String(overview.openNcrs)} sub="to close out" bad={overview.openNcrs > 0} />
        <Tile icon={<HardHat className="h-4 w-4" />} label="Days since incident" value={s.daysSinceLastIncident == null ? '—' : String(s.daysSinceLastIncident)} sub={`${s.incidents} on record`} bad={s.daysSinceLastIncident != null && s.daysSinceLastIncident < 7} />
        <Tile icon={<ShieldCheck className="h-4 w-4" />} label="Near-misses" value={String(s.nearMisses)} sub="free warnings" />
        <Tile icon={<ShieldAlert className="h-4 w-4" />} label="Permits" value={String(overview.openPermits)} sub={overview.expiredPermits ? `${overview.expiredPermits} lapsed` : 'open'} bad={overview.expiredPermits > 0} />
      </div>

      <div className="flex gap-1 border-b border-border">
        {(['inspections', 'ncr', 'safety', 'permits'] as Tab[]).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={cn('focus-ring -mb-px border-b-2 px-3 py-2 text-sm font-medium capitalize', tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground')}>{t === 'ncr' ? 'Non-conformance' : t}</button>
        ))}
      </div>

      {msg && <p className={cn('text-sm', msg.bad ? 'text-destructive' : 'text-emerald-600')}>{msg.text}</p>}

      {tab === 'inspections' && (
        <div className="space-y-3">
          {canManage && projectId && <AddBtn open={openForm === 'insp'} onClick={() => setOpenForm(openForm === 'insp' ? null : 'insp')} label="Add inspection" />}
          {openForm === 'insp' && canManage && projectId && (
            <form className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-3" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run(() => saveInspection({ projectId, title: f.get('title') as string, discipline: (f.get('discipline') as string) || null, isHoldPoint: f.get('isHoldPoint') === 'on', status: (f.get('status') as string) as never, inspectedBy: (f.get('inspectedBy') as string) || null })); }}>
              <Field label="Inspection *"><input name="title" required placeholder="Pre-pour reinforcement" className={inputCls} /></Field>
              <Field label="Discipline"><input name="discipline" placeholder="Structure, MEP…" className={inputCls} /></Field>
              <Field label="Status"><select name="status" defaultValue="SCHEDULED" className={inputCls}>{['SCHEDULED', 'PASSED', 'FAILED'].map((v) => <option key={v} value={v}>{v.toLowerCase()}</option>)}</select></Field>
              <Field label="Inspector"><input name="inspectedBy" className={inputCls} /></Field>
              <label className="flex items-center gap-2 text-xs mt-4"><input name="isHoldPoint" type="checkbox" /> Hold point (blocks certification)</label>
              <div className="sm:col-span-3"><button type="submit" disabled={pending} className={primaryBtn}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Save inspection</button></div>
            </form>
          )}
          {overview.inspections.length === 0 ? <Empty text="No inspections yet. Add hold points at the stages where work gets covered up — reinforcement, waterproofing, pre-pour." /> : (
            <div className="space-y-2">
              {overview.inspections.map((i) => (
                <div key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm">
                  <div>
                    <span className="font-medium">{i.title}</span>
                    {i.isHoldPoint && <span className="ml-2 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-600">hold point</span>}
                    <p className="mt-0.5 text-xs text-muted-foreground">{[i.discipline, i.inspectedBy && `by ${i.inspectedBy}`, i.inspectedOn && fmtDate(i.inspectedOn)].filter(Boolean).join(' · ') || '—'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={i.status} kind="inspection" />
                    {canManage && i.status !== 'PASSED' && <button type="button" disabled={pending} onClick={() => run(() => setInspectionResult(i.id, 'PASSED'))} className="focus-ring rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-60">Pass</button>}
                    {canManage && i.status !== 'FAILED' && <button type="button" disabled={pending} onClick={() => run(() => setInspectionResult(i.id, 'FAILED'))} className="focus-ring rounded-md border border-border px-2.5 py-1 text-xs disabled:opacity-60">Fail</button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'ncr' && (
        <div className="space-y-3">
          {canManage && projectId && <AddBtn open={openForm === 'ncr'} onClick={() => setOpenForm(openForm === 'ncr' ? null : 'ncr')} label="Raise NCR" />}
          {openForm === 'ncr' && canManage && projectId && (
            <form className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-3" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run(() => saveNcr({ projectId, title: f.get('title') as string, description: (f.get('description') as string) || null, severity: (f.get('severity') as string) as never, assignedTo: (f.get('assignedTo') as string) || null, costImpact: f.get('costImpact') ? Number(f.get('costImpact')) : null })); }}>
              <Field label="Title *"><input name="title" required className={inputCls} /></Field>
              <Field label="Severity"><select name="severity" defaultValue="MAJOR" className={inputCls}>{['MINOR', 'MAJOR', 'CRITICAL'].map((v) => <option key={v} value={v}>{v.toLowerCase()}</option>)}</select></Field>
              <Field label="Assigned to"><input name="assignedTo" className={inputCls} /></Field>
              <Field label="Cost impact (₹)"><input name="costImpact" type="number" step="1" className={inputCls} /></Field>
              <Field label="Description"><input name="description" className={inputCls} /></Field>
              <div className="sm:col-span-3"><button type="submit" disabled={pending} className={primaryBtn}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Raise NCR</button></div>
            </form>
          )}
          {overview.ncrs.length === 0 ? <Empty text="No non-conformances raised." /> : (
            <div className="space-y-2">
              {overview.ncrs.map((n) => (
                <div key={n.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm">
                  <div>
                    <span className="font-medium">{n.title}</span>
                    <span className={cn('ml-2 rounded-full px-2 py-0.5 text-xs', n.severity === 'CRITICAL' ? 'bg-destructive/10 text-destructive' : n.severity === 'MAJOR' ? 'bg-amber-500/10 text-amber-600' : 'bg-muted text-muted-foreground')}>{n.severity.toLowerCase()}</span>
                    <p className="mt-0.5 text-xs text-muted-foreground">{[n.assignedTo && `→ ${n.assignedTo}`, `raised ${fmtDate(n.raisedOn)}`, n.costImpact != null && inr(n.costImpact)].filter(Boolean).join(' · ')}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={n.status} kind="ncr" />
                    {canManage && n.status !== 'CLOSED' && <NcrAdvance id={n.id} status={n.status} pending={pending} run={run} />}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'safety' && (
        <div className="space-y-3">
          {canManage && projectId && <AddBtn open={openForm === 'saf'} onClick={() => setOpenForm(openForm === 'saf' ? null : 'saf')} label="Add safety record" />}
          {openForm === 'saf' && canManage && projectId && (
            <form className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-3" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run(() => saveSafetyRecord({ projectId, kind: (f.get('kind') as string) as never, severity: (f.get('severity') as string) as never, description: f.get('description') as string, rootCause: (f.get('rootCause') as string) || null, personsAffected: Number(f.get('personsAffected') || 0), occurredOn: (f.get('occurredOn') as string) || null })); }}>
              <Field label="Kind"><select name="kind" defaultValue="NEAR_MISS" className={inputCls}>{['INCIDENT', 'NEAR_MISS', 'TOOLBOX_TALK'].map((v) => <option key={v} value={v}>{v.replace(/_/g, ' ').toLowerCase()}</option>)}</select></Field>
              <Field label="Severity"><select name="severity" defaultValue="LOW" className={inputCls}>{['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((v) => <option key={v} value={v}>{v.toLowerCase()}</option>)}</select></Field>
              <Field label="Persons affected"><input name="personsAffected" type="number" min="0" defaultValue="0" className={inputCls} /></Field>
              <Field label="Description *"><input name="description" required className={inputCls} /></Field>
              <Field label="Root cause"><input name="rootCause" className={inputCls} /></Field>
              <Field label="Occurred on"><input name="occurredOn" type="date" className={inputCls} /></Field>
              <div className="sm:col-span-3"><button type="submit" disabled={pending} className={primaryBtn}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Save record</button></div>
            </form>
          )}
          {overview.safety.length === 0 ? <Empty text="No safety records. A near-miss recorded now is the warning you get for free." /> : (
            <div className="space-y-2">
              {overview.safety.map((r) => (
                <div key={r.id} className="rounded-lg border border-border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-border px-2 py-0.5 text-xs capitalize">{r.kind.replace(/_/g, ' ').toLowerCase()}</span>
                    <span className={cn('rounded-full px-2 py-0.5 text-xs', r.severity === 'CRITICAL' || r.severity === 'HIGH' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground')}>{r.severity.toLowerCase()}</span>
                    <span className="text-xs text-muted-foreground">{fmtDate(r.occurredOn)}{r.personsAffected ? ` · ${r.personsAffected} affected` : ''}</span>
                  </div>
                  <p className="mt-1">{r.description}</p>
                  {r.rootCause && <p className="mt-0.5 text-xs text-muted-foreground">Root cause: {r.rootCause}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'permits' && (
        <div className="space-y-3">
          {canManage && projectId && <AddBtn open={openForm === 'perm'} onClick={() => setOpenForm(openForm === 'perm' ? null : 'perm')} label="Issue permit" />}
          {openForm === 'perm' && canManage && projectId && (
            <form className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-3" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run(() => saveWorkPermit({ projectId, type: (f.get('type') as string) as never, issuedTo: f.get('issuedTo') as string, location: (f.get('location') as string) || null, validFrom: (f.get('validFrom') as string) || null, validTo: (f.get('validTo') as string) || null })); }}>
              <Field label="Type"><select name="type" defaultValue="HOT_WORK" className={inputCls}>{['HOT_WORK', 'HEIGHT', 'CONFINED_SPACE', 'LIFTING', 'ELECTRICAL', 'EXCAVATION', 'OTHER'].map((v) => <option key={v} value={v}>{v.replace(/_/g, ' ').toLowerCase()}</option>)}</select></Field>
              <Field label="Issued to *"><input name="issuedTo" required className={inputCls} /></Field>
              <Field label="Location"><input name="location" className={inputCls} /></Field>
              <Field label="Valid from"><input name="validFrom" type="date" className={inputCls} /></Field>
              <Field label="Valid to"><input name="validTo" type="date" className={inputCls} /></Field>
              <div className="sm:col-span-3"><button type="submit" disabled={pending} className={primaryBtn}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Issue permit</button></div>
            </form>
          )}
          {overview.permits.length === 0 ? <Empty text="No permits issued." /> : (
            <div className="space-y-2">
              {overview.permits.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm">
                  <div>
                    <span className="font-medium capitalize">{p.type.replace(/_/g, ' ').toLowerCase()}</span>
                    <span className="ml-2 text-xs text-muted-foreground">→ {p.issuedTo}{p.location ? ` · ${p.location}` : ''}{p.validTo ? ` · to ${fmtDate(p.validTo)}` : ''}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.expired ? <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">lapsed</span> : <StatusBadge status={p.status} kind="permit" />}
                    {canManage && p.status === 'OPEN' && <button type="button" disabled={pending} onClick={() => run(() => closeWorkPermit(p.id))} className="focus-ring rounded-md border border-border px-2.5 py-1 text-xs disabled:opacity-60">Close</button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NcrAdvance({ id, status, pending, run }: { id: string; status: string; pending: boolean; run: (fn: () => Promise<Res>) => void }) {
  const next: Record<string, 'ASSIGNED' | 'RECTIFIED' | 'VERIFIED' | 'CLOSED'> = { RAISED: 'ASSIGNED', ASSIGNED: 'RECTIFIED', RECTIFIED: 'VERIFIED', VERIFIED: 'CLOSED' };
  const n = next[status];
  if (!n) return null;
  return <button type="button" disabled={pending} onClick={() => run(() => advanceNcr(id, n))} className="focus-ring rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground disabled:opacity-60">→ {n.toLowerCase()}</button>;
}

function StatusBadge({ status, kind }: { status: string; kind: 'inspection' | 'ncr' | 'permit' }) {
  const good = (kind === 'inspection' && status === 'PASSED') || (kind === 'ncr' && status === 'CLOSED') || (kind === 'permit' && status === 'CLOSED');
  const bad = (kind === 'inspection' && status === 'FAILED');
  return <span className={cn('rounded-full px-2 py-0.5 text-xs capitalize', good ? 'bg-emerald-500/10 text-emerald-600' : bad ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground')}>{status.toLowerCase()}</span>;
}

function Tile({ icon, label, value, sub, bad }: { icon: ReactNode; label: string; value: string; sub: string; bad?: boolean }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</div>
      <div className={cn('mt-1 font-display text-xl font-semibold', bad ? 'text-destructive' : '')}>{value}</div>
      <div className="text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block text-xs"><span className="text-muted-foreground">{label}</span>{children}</label>; }
function AddBtn({ open, onClick, label }: { open: boolean; onClick: () => void; label: string }) { return <button type="button" onClick={onClick} className="focus-ring inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium">{open ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{open ? 'Close' : label}</button>; }
function Empty({ text }: { text: string }) { return <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{text}</div>; }
