'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { saveHearing, deleteHearing, setTitleExpiry } from '@/server/actions/legal-docket';
import { saveLitigation } from '@/server/actions/land';
import type { LitigationDocket, DocketMatter, DocRenewals, RenewalRow } from '@/lib/legal/types';

const STATUS = ['OPEN', 'HEARING', 'RESERVED', 'DISPOSED', 'APPEAL', 'CLOSED'] as const;
const STATUS_TONE: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-800', HEARING: 'bg-amber-100 text-amber-800', RESERVED: 'bg-violet-100 text-violet-800',
  DISPOSED: 'bg-emerald-100 text-emerald-800', APPEAL: 'bg-orange-100 text-orange-800', CLOSED: 'bg-slate-200 text-slate-700',
};
const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const inr = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

export function LegalDocket({ docket, renewals }: { docket: LitigationDocket; renewals: DocRenewals }) {
  const [tab, setTab] = React.useState<'docket' | 'renewals'>('docket');
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-[#1B2A4A]">Litigation & Renewals</h1>
        <p className="text-sm text-muted-foreground">Track every court matter with its full hearing history, and keep EC / Khata renewals from lapsing.</p>
      </div>
      <div className="flex gap-1 border-b border-slate-200">
        <TabBtn active={tab === 'docket'} onClick={() => setTab('docket')} label={`Litigation Docket (${docket.matters.length})`} />
        <TabBtn active={tab === 'renewals'} onClick={() => setTab('renewals')} label={`EC / Khata Renewals${renewals.expired + renewals.soon > 0 ? ` · ${renewals.expired + renewals.soon} to act` : ''}`} />
      </div>
      {tab === 'docket' ? <Docket docket={docket} /> : <Renewals renewals={renewals} />}
    </div>
  );
}

function TabBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return <button onClick={onClick} className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${active ? 'border-[#1B2A4A] text-[#1B2A4A]' : 'border-transparent text-muted-foreground hover:text-slate-700'}`}>{label}</button>;
}

function Docket({ docket }: { docket: LitigationDocket }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [showNew, setShowNew] = React.useState(false);

  const submitMatter = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const fd = new FormData(e.currentTarget); const form = e.currentTarget;
    start(async () => {
      const r = await saveLitigation({
        title: fd.get('title'), court: fd.get('court') || null, caseNumber: fd.get('caseNumber') || null,
        counsel: fd.get('counsel') || null, status: fd.get('status'), projectId: fd.get('projectId') || null,
        exposure: fd.get('exposure') ? Number(fd.get('exposure')) : null, nextHearing: fd.get('nextHearing') || null,
        summary: fd.get('summary') || null,
      });
      if ('error' in r) { toast.error(r.error); return; }
      toast.success('Matter saved'); form.reset(); setShowNew(false); router.refresh();
    });
  };

  const cls = 'rounded border border-slate-300 px-2 py-1 text-sm';
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={() => setShowNew((v) => !v)} className="rounded-md bg-[#1B2A4A] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#243a63]">{showNew ? 'Close' : 'New matter'}</button>
      </div>
      {showNew && (
        <form onSubmit={submitMatter} className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
          <label className="text-xs">Title *<br /><input name="title" required className={`${cls} w-full`} /></label>
          <label className="text-xs">Project<br /><select name="projectId" className={`${cls} w-full`}><option value="">— none —</option>{docket.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <label className="text-xs">Court<br /><input name="court" className={`${cls} w-full`} /></label>
          <label className="text-xs">Case number<br /><input name="caseNumber" className={`${cls} w-full`} /></label>
          <label className="text-xs">Counsel<br /><input name="counsel" className={`${cls} w-full`} /></label>
          <label className="text-xs">Status<br /><select name="status" defaultValue="OPEN" className={`${cls} w-full`}>{STATUS.map((s) => <option key={s}>{s}</option>)}</select></label>
          <label className="text-xs">Exposure (₹)<br /><input name="exposure" type="number" className={`${cls} w-full`} /></label>
          <label className="text-xs">Next hearing<br /><input name="nextHearing" type="date" className={`${cls} w-full`} /></label>
          <label className="text-xs sm:col-span-2">Summary<br /><textarea name="summary" rows={2} className={`${cls} w-full`} /></label>
          <div className="sm:col-span-2"><button disabled={pending} className="rounded bg-[#1B2A4A] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">Save matter</button></div>
        </form>
      )}
      {docket.matters.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-muted-foreground">No matters yet. Use <span className="font-semibold">New matter</span> to open the first one.</div>
      ) : docket.matters.map((m) => <MatterCard key={m.id} m={m} open={openId === m.id} onToggle={() => setOpenId(openId === m.id ? null : m.id)} />)}
    </div>
  );
}

function MatterCard({ m, open, onToggle }: { m: DocketMatter; open: boolean; onToggle: () => void }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const cls = 'rounded border border-slate-300 px-2 py-1 text-sm';

  const addHearing = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const fd = new FormData(e.currentTarget); const form = e.currentTarget;
    start(async () => {
      const r = await saveHearing({ matterId: m.id, date: fd.get('date'), purpose: fd.get('purpose') || null, outcome: fd.get('outcome') || null, nextDate: fd.get('nextDate') || null, notes: fd.get('notes') || null, updateMatterNext: true });
      if ('error' in r) { toast.error(r.error); return; }
      toast.success('Hearing added'); form.reset(); router.refresh();
    });
  };
  const removeHearing = (id: string) => start(async () => {
    const r = await deleteHearing(id); if ('error' in r) { toast.error(r.error); return; }
    toast.success('Hearing deleted'); router.refresh();
  });

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <button onClick={onToggle} className="flex w-full items-center justify-between gap-3 p-3 text-left">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold text-[#1B2A4A]">{m.title}</span>
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_TONE[m.status] ?? 'bg-slate-100'}`}>{m.status}</span>
          </div>
          <div className="truncate text-xs text-muted-foreground">{[m.court, m.caseNumber, m.counsel].filter(Boolean).join(' · ') || 'No court details yet'}</div>
        </div>
        <div className="shrink-0 text-right text-xs">
          <div className="text-muted-foreground">Next hearing</div>
          <div className="font-semibold">{fmtDate(m.nextHearing)}</div>
          {m.exposure != null && <div className="text-[11px] text-rose-700">₹ {inr(m.exposure)} at risk</div>}
        </div>
      </button>
      {open && (
        <div className="border-t border-slate-100 p-3">
          {m.summary && <p className="mb-3 rounded bg-slate-50 p-2 text-xs text-slate-700">{m.summary}</p>}
          <h4 className="mb-2 text-xs font-semibold text-[#1B2A4A]">Hearing docket ({m.hearings.length})</h4>
          {m.hearings.length === 0 ? <p className="mb-3 text-xs text-muted-foreground">No hearings recorded yet.</p> : (
            <ol className="mb-3 space-y-2 border-l-2 border-[#A07D34]/40 pl-3">
              {m.hearings.map((h) => (
                <li key={h.id} className="relative">
                  <span className="absolute -left-[15px] top-1 h-2 w-2 rounded-full bg-[#A07D34]" />
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-xs">
                      <span className="font-semibold">{fmtDate(h.date)}</span>{h.purpose && <span className="text-muted-foreground"> · {h.purpose}</span>}
                      {h.outcome && <div className="text-slate-700">{h.outcome}</div>}
                      {h.nextDate && <div className="text-[11px] text-muted-foreground">Next date given: {fmtDate(h.nextDate)}</div>}
                      {h.notes && <div className="text-[11px] italic text-muted-foreground">{h.notes}</div>}
                    </div>
                    <button onClick={() => removeHearing(h.id)} disabled={pending} className="text-[11px] text-rose-600 hover:underline">delete</button>
                  </div>
                </li>
              ))}
            </ol>
          )}
          <form onSubmit={addHearing} className="grid gap-2 rounded border border-slate-200 bg-slate-50 p-2 sm:grid-cols-2">
            <label className="text-xs">Hearing date *<br /><input name="date" type="date" required className={`${cls} w-full`} /></label>
            <label className="text-xs">Purpose<br /><input name="purpose" placeholder="Arguments / Evidence…" className={`${cls} w-full`} /></label>
            <label className="text-xs sm:col-span-2">Outcome<br /><input name="outcome" placeholder="What happened" className={`${cls} w-full`} /></label>
            <label className="text-xs">Next date given<br /><input name="nextDate" type="date" className={`${cls} w-full`} /></label>
            <label className="text-xs">Notes<br /><input name="notes" className={`${cls} w-full`} /></label>
            <div className="sm:col-span-2"><button disabled={pending} className="rounded bg-[#1B2A4A] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">Add to docket</button></div>
          </form>
        </div>
      )}
    </div>
  );
}

const RENEW_TONE: Record<string, string> = {
  expired: 'bg-rose-100 text-rose-800', soon: 'bg-amber-100 text-amber-800', ok: 'bg-emerald-100 text-emerald-800', untracked: 'bg-slate-100 text-slate-600',
};
const RENEW_LABEL: Record<string, string> = { expired: 'Expired', soon: 'Expiring soon', ok: 'Valid', untracked: 'Not tracked' };

function Renewals({ renewals }: { renewals: DocRenewals }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-3 py-1 font-medium text-rose-800">Expired <b>{renewals.expired}</b></span>
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 font-medium text-amber-800">Expiring soon <b>{renewals.soon}</b></span>
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">Tracked <b>{renewals.tracked}</b></span>
      </div>
      {renewals.rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-muted-foreground">
          No EC or Khata documents found. Add them under Land & Approvals (as title documents of kind Encumbrance Certificate or Khata); they’ll appear here to track renewals.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 text-left text-xs text-muted-foreground"><th className="p-2">Document</th><th className="p-2">Parcel</th><th className="p-2">Kind</th><th className="p-2">Status</th><th className="p-2">Renew by</th><th className="p-2">Note</th></tr></thead>
            <tbody>{renewals.rows.map((r) => <RenewalRowView key={r.id} r={r} />)}</tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">EC (Encumbrance Certificate) and Khata typically need periodic renewal. Set a “renew by” date and the row turns amber 60 days out and red once overdue.</p>
    </div>
  );
}

function RenewalRowView({ r }: { r: RenewalRow }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [date, setDate] = React.useState(r.expiresOn ? r.expiresOn.slice(0, 10) : '');
  const [note, setNote] = React.useState(r.renewalNote ?? '');
  const save = (nextDate: string, nextNote: string) => start(async () => {
    const res = await setTitleExpiry({ id: r.id, expiresOn: nextDate || null, renewalNote: nextNote || null });
    if ('error' in res) { toast.error(res.error); return; }
    toast.success('Renewal updated'); router.refresh();
  });
  return (
    <tr className="border-t border-slate-100 align-top">
      <td className="p-2 font-medium">{r.title}</td>
      <td className="p-2 text-xs text-muted-foreground">{r.parcelName}</td>
      <td className="p-2 text-xs">{r.kind.replace(/_/g, ' ')}</td>
      <td className="p-2"><span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${RENEW_TONE[r.state]}`}>{RENEW_LABEL[r.state]}{r.daysToExpiry != null && r.state !== 'ok' ? ` · ${r.daysToExpiry < 0 ? `${-r.daysToExpiry}d ago` : `${r.daysToExpiry}d`}` : ''}</span></td>
      <td className="p-2"><input type="date" value={date} onChange={(e) => { setDate(e.target.value); }} onBlur={(e) => { if (e.target.value !== (r.expiresOn ? r.expiresOn.slice(0, 10) : '')) save(e.target.value, note); }} disabled={pending} className="rounded border border-slate-300 px-1.5 py-1 text-xs" /></td>
      <td className="p-2"><input value={note} onChange={(e) => setNote(e.target.value)} onBlur={(e) => { if (e.target.value !== (r.renewalNote ?? '')) save(date, e.target.value); }} placeholder="e.g. apply at sub-registrar" disabled={pending} className="w-40 rounded border border-slate-300 px-1.5 py-1 text-xs" /></td>
    </tr>
  );
}
