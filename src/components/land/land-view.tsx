'use client';

import { useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2, Plus, ShieldAlert, ShieldCheck, Clock, AlertTriangle, Scale, MapPinned, FileCheck2, X,
} from 'lucide-react';
import {
  saveParcel, saveApproval, saveTitleDocument, setTitleVerified, addLiaisonLog, saveLitigation,
} from '@/server/actions/land';
import type { TitleChainAnalysis } from '@/lib/land/title-chain';
import type { SanctionSummary } from '@/lib/land/approvals';
import { cn } from '@/lib/utils/cn';

const inr = (n: number | null) =>
  n == null ? '—' : n.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const fmtDate = (d: Date | string | null) =>
  d == null ? '—' : new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

// Prop types are declared locally: a client component may not import from
// @/server/services (the verifier enforces it), and these mirror the service.
interface Parcel {
  id: string; name: string; projectId: string | null; surveyNumber: string | null;
  village: string | null; district: string | null; state: string; extentAcre: number | null;
  ownerName: string | null; askingRate: number | null; agreedRate: number | null; stage: string;
  title: TitleChainAnalysis; jdaCount: number; revenueCount: number; approvalCount: number;
}
interface Approval {
  id: string; authority: string; name: string; status: string; parcelId: string | null;
  projectId: string | null; appliedOn: Date | null; expectedOn: Date | null; approvedOn: Date | null;
  expiresOn: Date | null; feePaid: number | null; currentDesk: string | null; referenceNo: string | null;
  overdue: boolean; daysOverdue: number; expiringSoon: boolean; expired: boolean;
  daysToExpiry: number | null; liaisonCount: number;
}
interface Litigation {
  id: string; title: string; court: string | null; caseNumber: string | null; counsel: string | null;
  status: string; nextHearing: Date | null; exposure: number | null; projectId: string | null;
}

const STAGE_LABEL: Record<string, string> = {
  IDENTIFIED: 'Identified', UNDER_NEGOTIATION: 'Negotiating', AGREED: 'Agreed',
  DUE_DILIGENCE: 'Due diligence', REGISTERED: 'Registered', DROPPED: 'Dropped',
};
const STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: 'Not started', APPLIED: 'Applied', IN_PROCESS: 'In process', QUERY_RAISED: 'Query raised',
  APPROVED: 'Approved', REJECTED: 'Rejected', EXPIRED: 'Expired',
};

type Tab = 'parcels' | 'approvals' | 'litigation';

export function LandView(props: {
  canManage: boolean;
  projects: Array<{ id: string; name: string }>;
  projectId: string | null;
  parcels: Parcel[];
  approvals: Approval[];
  approvalSummary: SanctionSummary;
  litigation: Litigation[];
  parcelsWithGaps: number;
}) {
  const { canManage, projects, projectId, parcels, approvals, approvalSummary, litigation, parcelsWithGaps } = props;
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('parcels');
  const [msg, setMsg] = useState<{ bad: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [openForm, setOpenForm] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: true; message: string } | { error: string }>) =>
    start(async () => {
      const r = await fn();
      setMsg('error' in r ? { bad: true, text: r.error } : { bad: false, text: r.message });
      if (!('error' in r)) { setOpenForm(null); router.refresh(); }
    });

  const link = (id: string | null) => `/land${id ? `?project=${id}` : ''}`;

  return (
    <div className="space-y-4">
      {projects.length > 1 && (
        <div className="chip-row">
          <a href={link(null)} className={cn('focus-ring shrink-0 rounded-full border px-3 py-1 text-xs font-medium', projectId == null ? 'border-primary bg-primary/10 text-primary' : 'border-border')}>All parcels</a>
          {projects.map((p) => (
            <a key={p.id} href={link(p.id)} className={cn('focus-ring shrink-0 rounded-full border px-3 py-1 text-xs font-medium', p.id === projectId ? 'border-primary bg-primary/10 text-primary' : 'border-border')}>{p.name}</a>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile icon={<MapPinned className="h-4 w-4" />} label="Parcels" value={parcels.length} sub={parcelsWithGaps ? `${parcelsWithGaps} with title gaps` : 'title chains clean'} bad={parcelsWithGaps > 0} />
        <Tile icon={<Clock className="h-4 w-4" />} label="Approvals overdue" value={approvalSummary.overdue} sub={`${approvalSummary.open} still open`} bad={approvalSummary.overdue > 0} />
        <Tile icon={<AlertTriangle className="h-4 w-4" />} label="Expiring soon" value={approvalSummary.expiringSoon} sub={approvalSummary.expired ? `${approvalSummary.expired} already lapsed` : 'within 60 days'} bad={approvalSummary.expiringSoon > 0 || approvalSummary.expired > 0} />
        <Tile icon={<Scale className="h-4 w-4" />} label="Matters in court" value={litigation.filter((m) => !['DISPOSED', 'CLOSED'].includes(m.status)).length} sub={`${litigation.length} on record`} bad={false} />
      </div>

      <div className="flex gap-1 border-b border-border">
        {(['parcels', 'approvals', 'litigation'] as Tab[]).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={cn('focus-ring -mb-px border-b-2 px-3 py-2 text-sm font-medium capitalize', tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground')}>
            {t === 'litigation' ? 'Litigation' : t}
          </button>
        ))}
      </div>

      {msg && <p className={cn('text-sm', msg.bad ? 'text-destructive' : 'text-emerald-600')}>{msg.text}</p>}

      {tab === 'parcels' && (
        <ParcelsTab parcels={parcels} canManage={canManage} projects={projects} projectId={projectId}
          pending={pending} openForm={openForm} setOpenForm={setOpenForm} run={run} />
      )}
      {tab === 'approvals' && (
        <ApprovalsTab approvals={approvals} parcels={parcels} canManage={canManage} projects={projects} projectId={projectId}
          pending={pending} openForm={openForm} setOpenForm={setOpenForm} run={run} />
      )}
      {tab === 'litigation' && (
        <LitigationTab litigation={litigation} canManage={canManage} projects={projects} projectId={projectId}
          pending={pending} openForm={openForm} setOpenForm={setOpenForm} run={run} />
      )}
    </div>
  );
}

function Tile({ icon, label, value, sub, bad }: { icon: ReactNode; label: string; value: number; sub: string; bad: boolean }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</div>
      <div className={cn('mt-1 font-display text-2xl font-semibold', bad ? 'text-destructive' : '')}>{value}</div>
      <div className="text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

type RunFn = (fn: () => Promise<{ ok: true; message: string } | { error: string }>) => void;
interface TabShared {
  canManage: boolean; projects: Array<{ id: string; name: string }>; projectId: string | null;
  pending: boolean; openForm: string | null; setOpenForm: (v: string | null) => void; run: RunFn;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-xs">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
const inputCls = 'focus-ring mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm';

function AddButton({ open, onClick, label }: { open: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className="focus-ring inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium">
      {open ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{open ? 'Close' : label}
    </button>
  );
}

function ParcelsTab({ parcels, canManage, projects, projectId, pending, openForm, setOpenForm, run }: TabShared & { parcels: Parcel[] }) {
  const key = 'parcel';
  return (
    <div className="space-y-3">
      {canManage && (
        <div>
          <AddButton open={openForm === key} onClick={() => setOpenForm(openForm === key ? null : key)} label="Add parcel" />
          {openForm === key && (
            <form className="mt-3 grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-3"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                run(() => saveParcel({
                  projectId: (f.get('projectId') as string) || null,
                  name: f.get('name') as string,
                  surveyNumber: (f.get('surveyNumber') as string) || null,
                  village: (f.get('village') as string) || null,
                  district: (f.get('district') as string) || null,
                  state: (f.get('state') as string) || 'Karnataka',
                  extentAcre: f.get('extentAcre') ? Number(f.get('extentAcre')) : null,
                  ownerName: (f.get('ownerName') as string) || null,
                  askingRate: f.get('askingRate') ? Number(f.get('askingRate')) : null,
                  stage: (f.get('stage') as string) as never,
                }));
              }}>
              <Field label="Parcel name *"><input name="name" required className={inputCls} /></Field>
              <Field label="Survey number"><input name="surveyNumber" className={inputCls} /></Field>
              <Field label="Owner"><input name="ownerName" className={inputCls} /></Field>
              <Field label="Village"><input name="village" className={inputCls} /></Field>
              <Field label="District"><input name="district" className={inputCls} /></Field>
              <Field label="State"><input name="state" defaultValue="Karnataka" className={inputCls} /></Field>
              <Field label="Extent (acres)"><input name="extentAcre" type="number" step="0.0001" className={inputCls} /></Field>
              <Field label="Asking rate (₹)"><input name="askingRate" type="number" step="1" className={inputCls} /></Field>
              <Field label="Stage">
                <select name="stage" defaultValue="IDENTIFIED" className={inputCls}>
                  {Object.entries(STAGE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Field>
              <Field label="Project (optional)">
                <select name="projectId" defaultValue={projectId ?? ''} className={inputCls}>
                  <option value="">— none —</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
              <div className="sm:col-span-3">
                <button type="submit" disabled={pending} className="focus-ring inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
                  {pending && <Loader2 className="h-4 w-4 animate-spin" />}Save parcel
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {parcels.length === 0 ? (
        <Empty text="No parcels yet. Add the first one to start the acquisition pipeline." />
      ) : parcels.map((p) => (
        <div key={p.id} className="rounded-lg border border-border p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-lg font-semibold">{p.name}</h3>
                <span className="rounded-full border border-border px-2 py-0.5 text-xs">{STAGE_LABEL[p.stage] ?? p.stage}</span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {[p.surveyNumber && `Survey ${p.surveyNumber}`, p.village, p.district, p.state].filter(Boolean).join(' · ')}
                {p.ownerName ? ` · Owner: ${p.ownerName}` : ''}
                {p.extentAcre != null ? ` · ${p.extentAcre} acres` : ''}
              </p>
            </div>
            <TitleBadge title={p.title} />
          </div>

          {p.title.gaps.length > 0 && (
            <ul className="mt-3 space-y-1 rounded-md bg-destructive/5 p-3 text-xs text-destructive">
              {p.title.gaps.map((g, i) => <li key={i} className="flex gap-1.5"><ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />{g.detail}</li>)}
            </ul>
          )}

          {p.title.links.length > 0 && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-muted-foreground"><tr className="text-left"><th className="py-1 pr-2">#</th><th className="pr-2">Document</th><th className="pr-2">From → To</th><th className="pr-2">Verified</th></tr></thead>
                <tbody>
                  {p.title.links.map((l) => (
                    <tr key={l.id} className="border-t border-border">
                      <td className="py-1 pr-2">{l.chainOrder}</td>
                      <td className="pr-2">{l.title} <span className="text-muted-foreground">({l.kind.replace(/_/g, ' ').toLowerCase()})</span></td>
                      <td className="pr-2">{l.fromParty ?? '—'} → {l.toParty ?? '—'}</td>
                      <td className="pr-2">
                        {canManage ? (
                          <button type="button" disabled={pending} onClick={() => run(() => setTitleVerified(l.id, !l.verified))}
                            className={cn('rounded px-1.5 py-0.5', l.verified ? 'text-emerald-600' : 'text-muted-foreground')}>
                            {l.verified ? 'Verified' : 'Mark verified'}
                          </button>
                        ) : (l.verified ? 'Yes' : 'No')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {canManage && (
            <div className="mt-3">
              <AddButton open={openForm === `title-${p.id}`} onClick={() => setOpenForm(openForm === `title-${p.id}` ? null : `title-${p.id}`)} label="Add title link" />
              {openForm === `title-${p.id}` && (
                <form className="mt-3 grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    run(() => saveTitleDocument({
                      parcelId: p.id,
                      kind: (f.get('kind') as string) as never,
                      title: f.get('title') as string,
                      chainOrder: Number(f.get('chainOrder') || 0),
                      fromParty: (f.get('fromParty') as string) || null,
                      toParty: (f.get('toParty') as string) || null,
                      registrationNo: (f.get('registrationNo') as string) || null,
                    }));
                  }}>
                  <Field label="Document title *"><input name="title" required className={inputCls} /></Field>
                  <Field label="Kind">
                    <select name="kind" defaultValue="SALE_DEED" className={inputCls}>
                      {['MOTHER_DEED', 'SALE_DEED', 'GIFT_DEED', 'PARTITION_DEED', 'ENCUMBRANCE_CERTIFICATE', 'KHATA', 'CONVERSION_ORDER', 'POWER_OF_ATTORNEY', 'COURT_ORDER', 'OTHER'].map((k) => <option key={k} value={k}>{k.replace(/_/g, ' ').toLowerCase()}</option>)}
                    </select>
                  </Field>
                  <Field label="Chain order"><input name="chainOrder" type="number" min="0" defaultValue={p.title.links.length} className={inputCls} /></Field>
                  <Field label="From party"><input name="fromParty" className={inputCls} /></Field>
                  <Field label="To party"><input name="toParty" className={inputCls} /></Field>
                  <Field label="Registration no."><input name="registrationNo" className={inputCls} /></Field>
                  <div className="sm:col-span-3">
                    <button type="submit" disabled={pending} className="focus-ring inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
                      {pending && <Loader2 className="h-4 w-4 animate-spin" />}Add link
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function TitleBadge({ title }: { title: TitleChainAnalysis }) {
  if (title.links.length === 0) return <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">No title docs</span>;
  if (title.clean) return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-600"><ShieldCheck className="h-3.5 w-3.5" />Chain clean</span>;
  if (title.gaps.length > 0) return <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive"><ShieldAlert className="h-3.5 w-3.5" />{title.gaps.length} gap{title.gaps.length > 1 ? 's' : ''}</span>;
  return <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-600"><FileCheck2 className="h-3.5 w-3.5" />{title.verifiedCount}/{title.links.length} verified</span>;
}

function ApprovalsTab({ approvals, parcels, canManage, projects, projectId, pending, openForm, setOpenForm, run }: TabShared & { approvals: Approval[]; parcels: Parcel[] }) {
  const key = 'approval';
  return (
    <div className="space-y-3">
      {canManage && (
        <div>
          <AddButton open={openForm === key} onClick={() => setOpenForm(openForm === key ? null : key)} label="Add approval" />
          {openForm === key && (
            <form className="mt-3 grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-3"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                run(() => saveApproval({
                  projectId: (f.get('projectId') as string) || null,
                  parcelId: (f.get('parcelId') as string) || null,
                  authority: f.get('authority') as string,
                  name: f.get('name') as string,
                  status: (f.get('status') as string) as never,
                  appliedOn: (f.get('appliedOn') as string) || null,
                  expectedOn: (f.get('expectedOn') as string) || null,
                  expiresOn: (f.get('expiresOn') as string) || null,
                  feePaid: f.get('feePaid') ? Number(f.get('feePaid')) : null,
                  currentDesk: (f.get('currentDesk') as string) || null,
                }));
              }}>
              <Field label="Authority *"><input name="authority" required placeholder="BBMP, BDA, Fire, TN DTCP…" className={inputCls} /></Field>
              <Field label="Approval *"><input name="name" required placeholder="Plan sanction, Fire NOC…" className={inputCls} /></Field>
              <Field label="Status">
                <select name="status" defaultValue="APPLIED" className={inputCls}>
                  {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Field>
              <Field label="Applied on"><input name="appliedOn" type="date" className={inputCls} /></Field>
              <Field label="Expected by"><input name="expectedOn" type="date" className={inputCls} /></Field>
              <Field label="Expires on"><input name="expiresOn" type="date" className={inputCls} /></Field>
              <Field label="Fee paid (₹)"><input name="feePaid" type="number" step="1" className={inputCls} /></Field>
              <Field label="Current desk"><input name="currentDesk" className={inputCls} /></Field>
              <Field label="Parcel (optional)">
                <select name="parcelId" defaultValue="" className={inputCls}>
                  <option value="">— none —</option>
                  {parcels.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
              <Field label="Project (optional)">
                <select name="projectId" defaultValue={projectId ?? ''} className={inputCls}>
                  <option value="">— none —</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
              <div className="sm:col-span-3">
                <button type="submit" disabled={pending} className="focus-ring inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
                  {pending && <Loader2 className="h-4 w-4 animate-spin" />}Save approval
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {approvals.length === 0 ? (
        <Empty text="No approvals on record. Add the sanctions each authority requires so a passed date is flagged, not forgotten." />
      ) : (
        <div className="space-y-2">
          {approvals.map((a) => (
            <div key={a.id} className="rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{a.authority}</span>
                    <span className="text-muted-foreground">— {a.name}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {STATUS_LABEL[a.status] ?? a.status}
                    {a.currentDesk ? ` · desk: ${a.currentDesk}` : ''}
                    {a.expectedOn ? ` · expected ${fmtDate(a.expectedOn)}` : ''}
                    {a.expiresOn ? ` · expires ${fmtDate(a.expiresOn)}` : ''}
                    {a.feePaid != null ? ` · fee ${inr(a.feePaid)}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {a.overdue && <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">{a.daysOverdue}d overdue</span>}
                  {a.expiringSoon && a.daysToExpiry != null && <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-600">expires in {a.daysToExpiry}d</span>}
                  {a.expired && <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">lapsed</span>}
                  {a.status === 'APPROVED' && !a.expired && !a.expiringSoon && <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-600">approved</span>}
                </div>
              </div>
              {canManage && (
                <div className="mt-2">
                  <button type="button" onClick={() => setOpenForm(openForm === `liaison-${a.id}` ? null : `liaison-${a.id}`)} className="text-xs text-primary underline-offset-2 hover:underline">
                    {a.liaisonCount > 0 ? `${a.liaisonCount} liaison note${a.liaisonCount > 1 ? 's' : ''} · add another` : 'Add liaison note'}
                  </button>
                  {openForm === `liaison-${a.id}` && (
                    <form className="mt-2 flex flex-wrap gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        run(() => addLiaisonLog({ approvalId: a.id, note: f.get('note') as string, metWith: (f.get('metWith') as string) || null }));
                      }}>
                      <input name="note" required placeholder="What happened / next step" className={cn(inputCls, 'flex-1 min-w-[200px]')} />
                      <input name="metWith" placeholder="Met with" className={cn(inputCls, 'w-40')} />
                      <button type="submit" disabled={pending} className="focus-ring rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60">Log</button>
                    </form>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LitigationTab({ litigation, canManage, projects, projectId, pending, openForm, setOpenForm, run }: TabShared & { litigation: Litigation[] }) {
  const key = 'litigation';
  return (
    <div className="space-y-3">
      {canManage && (
        <div>
          <AddButton open={openForm === key} onClick={() => setOpenForm(openForm === key ? null : key)} label="Add matter" />
          {openForm === key && (
            <form className="mt-3 grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-3"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                run(() => saveLitigation({
                  projectId: (f.get('projectId') as string) || null,
                  title: f.get('title') as string,
                  court: (f.get('court') as string) || null,
                  caseNumber: (f.get('caseNumber') as string) || null,
                  counsel: (f.get('counsel') as string) || null,
                  status: (f.get('status') as string) as never,
                  nextHearing: (f.get('nextHearing') as string) || null,
                  exposure: f.get('exposure') ? Number(f.get('exposure')) : null,
                }));
              }}>
              <Field label="Matter *"><input name="title" required className={inputCls} /></Field>
              <Field label="Court"><input name="court" className={inputCls} /></Field>
              <Field label="Case number"><input name="caseNumber" className={inputCls} /></Field>
              <Field label="Counsel"><input name="counsel" className={inputCls} /></Field>
              <Field label="Status">
                <select name="status" defaultValue="OPEN" className={inputCls}>
                  {['OPEN', 'HEARING', 'RESERVED', 'DISPOSED', 'APPEAL', 'CLOSED'].map((v) => <option key={v} value={v}>{v.toLowerCase()}</option>)}
                </select>
              </Field>
              <Field label="Next hearing"><input name="nextHearing" type="date" className={inputCls} /></Field>
              <Field label="Exposure (₹)"><input name="exposure" type="number" step="1" className={inputCls} /></Field>
              <Field label="Project (optional)">
                <select name="projectId" defaultValue={projectId ?? ''} className={inputCls}>
                  <option value="">— none —</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
              <div className="sm:col-span-3">
                <button type="submit" disabled={pending} className="focus-ring inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
                  {pending && <Loader2 className="h-4 w-4 animate-spin" />}Save matter
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {litigation.length === 0 ? (
        <Empty text="No matters on record. A court date that passes unnoticed is the expensive kind." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr className="text-left"><th className="p-2">Matter</th><th className="p-2">Court</th><th className="p-2">Counsel</th><th className="p-2">Status</th><th className="p-2">Next hearing</th><th className="p-2">Exposure</th></tr>
            </thead>
            <tbody>
              {litigation.map((m) => (
                <tr key={m.id} className="border-t border-border">
                  <td className="p-2">{m.title}{m.caseNumber ? <span className="block text-xs text-muted-foreground">{m.caseNumber}</span> : null}</td>
                  <td className="p-2">{m.court ?? '—'}</td>
                  <td className="p-2">{m.counsel ?? '—'}</td>
                  <td className="p-2 capitalize">{m.status.toLowerCase()}</td>
                  <td className="p-2">{fmtDate(m.nextHearing)}</td>
                  <td className="p-2">{inr(m.exposure)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{text}</div>;
}
