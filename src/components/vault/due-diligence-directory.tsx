'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Landmark, Search, ExternalLink, UploadCloud, ChevronDown, ShieldAlert, FileCheck2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatCard } from '@/components/layout/stat-card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RecordList } from '@/components/shared/record-row';
import { UniversalUploader } from '@/components/shared/universal-uploader';
import { DD_DIRECTORY, authorityMatches, type Authority } from '@/config/dd-authorities';
import { saveDueDiligenceRecord, verifyDueDiligenceRecord, deleteDueDiligenceRecord, type DueDiligenceInput } from '@/server/actions/due-diligence';

const RECORD_TYPES = [
  'RERA_CERTIFICATE', 'ENCUMBRANCE_CERTIFICATE', 'LAND_RECORD_ROR', 'COURT_CLEARANCE', 'TOWN_PLANNING_APPROVAL',
  'MUNICIPAL_SANCTION', 'HILL_AREA_CLEARANCE', 'MASTER_PLAN_EXTRACT', 'FIRE_NOC', 'AIRPORT_HEIGHT_CLEARANCE',
  'ENVIRONMENT_CLEARANCE', 'WATER_APPROVAL', 'ELECTRICITY_APPROVAL', 'LAND_TITLE', 'EC', 'PATTA', 'CHITTA',
  'ADANGAL', 'SURVEY_SKETCH', 'FMB', 'NA_ORDER',
];
const KIND_TONE: Record<string, string> = { RERA: 'bg-emerald-500/10 text-emerald-600', Land: 'bg-amber-500/10 text-amber-600', Registration: 'bg-blue-500/10 text-blue-600', Planning: 'bg-violet-500/10 text-violet-600', Municipal: 'bg-slate-500/10 text-slate-600', Hill: 'bg-teal-500/10 text-teal-600' };
const STATUS_TONE: Record<string, 'success' | 'warning' | 'destructive' | 'secondary'> = { VERIFIED: 'success', PENDING: 'warning', REJECTED: 'destructive', EXPIRED: 'destructive' };

export interface DdRecord { id: string; project: string; recordType: string; state: string; region: string | null; authorityName: string; reference: string | null; documentUrl: string | null; validUntil: string | null; status: string; expiring: boolean }

export function DueDiligenceDirectory({ records, projects }: { records: DdRecord[]; projects: { id: string; name: string }[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const [q, setQ] = React.useState('');
  const [openState, setOpenState] = React.useState<string | null>(DD_DIRECTORY[0]?.state ?? null);
  const [fileFor, setFileFor] = React.useState<{ authority: Authority; state: string; projectId?: string; autoUpload?: boolean } | null>(null);
  const highlightId = params.get('recordId');

  // Consume URL intent from the Command Palette / Alerts:
  //   ?authority=CMDA&action=upload&projectId=<id>&recordId=<id>
  React.useEffect(() => {
    const authorityQ = params.get('authority');
    const action = params.get('action');
    const projectId = params.get('projectId') ?? undefined;
    if (!authorityQ) return;
    for (const s of DD_DIRECTORY) {
      const hit = s.authorities.find((a) => authorityMatches({ ...a, state: s.state }, authorityQ));
      if (hit) {
        setOpenState(s.state);
        if (action === 'upload') setFileFor({ authority: hit, state: s.state, projectId, autoUpload: true });
        break;
      }
    }
    // Re-prime on live deep-link changes within the same mounted instance:
    // navigating ?authority / ?action / ?projectId re-fires state expansion + uploader priming.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.get('authority'), params.get('action'), params.get('projectId')]);

  // Scroll a deep-linked record into view.
  React.useEffect(() => {
    if (!highlightId) return;
    const el = document.getElementById(`ddr-${highlightId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightId]);

  const term = q.trim();
  const dir = DD_DIRECTORY.map((s) => ({
    ...s,
    authorities: s.authorities.filter((a) => !term || authorityMatches({ ...a, state: s.state }, term)),
  })).filter((s) => s.authorities.length);

  const expiringCount = records.filter((r) => r.expiring).length;

  function verify(id: string, status: 'VERIFIED' | 'REJECTED') { verifyDueDiligenceRecord(id, status).then((r) => { if ('error' in r) { toast.error(r.error); return; } toast.success(`Marked ${status.toLowerCase()}`); router.refresh(); }); }
  function remove(id: string) { deleteDueDiligenceRecord(id).then((r) => { if ('error' in r) { toast.error(r.error); return; } toast.success('Removed'); router.refresh(); }); }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard label="Records on file" value={records.length} icon={FileCheck2} />
        <StatCard label="Expiring / stale" value={expiringCount} icon={ShieldAlert} tone={expiringCount ? 'warning' : 'success'} />
        <StatCard label="Authorities mapped" value={DD_DIRECTORY.reduce((n, s) => n + s.authorities.length, 0)} icon={Landmark} />
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search authorities — e.g. CMDA, Kodaikanal HACA, Indore Bhulekh, PMRDA" className="pl-9" />
      </div>

      <div className="space-y-2">
        {dir.map((s) => {
          const open = openState === s.state || !!term;
          return (
            <div key={s.state} className="overflow-hidden rounded-lg border">
              <button className="flex w-full items-center justify-between bg-muted/30 px-4 py-3 text-left" onClick={() => setOpenState(open && !term ? null : s.state)}>
                <span className="text-sm font-semibold">{s.state} <span className="ml-1 font-normal text-muted-foreground">· {s.blurb}</span></span>
                <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
              </button>
              {open ? (
                <div className="divide-y">
                  {s.authorities.map((a) => (
                    <div key={a.name} className="flex items-center gap-3 px-4 py-2.5">
                      <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium', KIND_TONE[a.kind] ?? 'bg-muted text-muted-foreground')}>{a.kind}</span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{a.name}{a.region ? <span className="ml-1 text-xs text-muted-foreground">· {a.region}</span> : ''}</div>
                        {a.note ? <div className="truncate text-xs text-muted-foreground">{a.note}</div> : null}
                      </div>
                      <a href={a.url} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium hover:bg-muted">
                        Open portal <ExternalLink className="h-3 w-3" />
                      </a>
                      <Button size="sm" variant="secondary" className="shrink-0 gap-1" onClick={() => setFileFor({ authority: a, state: s.state })}>
                        <UploadCloud className="h-3.5 w-3.5" /> File
                      </Button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div>
        <div className="mb-2 text-sm font-medium">Vault — filed records</div>
        <RecordList empty="No records filed yet. Open a portal, download the document, then click File to drop it into the vault.">
          {records.map((r) => (
            <div key={r.id} id={`ddr-${r.id}`} className={cn('flex items-center gap-3 border-b px-3 py-2.5 last:border-b-0', highlightId === r.id && 'rounded-md bg-amber-500/10 ring-1 ring-amber-500/40')}>
              {r.expiring ? <ShieldAlert className="h-4 w-4 shrink-0 text-amber-500" /> : null}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{r.recordType.replace(/_/g, ' ')} <span className="text-xs text-muted-foreground">· {r.authorityName}</span></div>
                <div className="truncate text-xs text-muted-foreground">
                  {r.project} · {r.state}{r.region ? `, ${r.region}` : ''}{r.reference ? ` · ${r.reference}` : ''}{r.validUntil ? ` · valid to ${new Date(r.validUntil).toLocaleDateString('en-IN')}` : ''}
                </div>
              </div>
              {r.documentUrl ? <a href={r.documentUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 text-xs text-primary hover:underline">PDF</a> : null}
              <Link href={`/due-diligence/${r.id}`} className="shrink-0 text-xs text-primary hover:underline">View</Link>
              <Badge variant={STATUS_TONE[r.status] ?? 'secondary'} className="shrink-0">{r.status}</Badge>
              {r.status !== 'VERIFIED' ? <Button size="sm" variant="ghost" className="h-7 shrink-0 px-2 text-xs" onClick={() => verify(r.id, 'VERIFIED')}>Verify</Button> : null}
              <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => remove(r.id)} aria-label="Delete this record"><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </RecordList>
      </div>

      {fileFor ? <FileDialog projects={projects} authority={fileFor.authority} state={fileFor.state} presetProjectId={fileFor.projectId} autoUpload={fileFor.autoUpload} onClose={() => setFileFor(null)} onSaved={() => router.refresh()} /> : null}
    </div>
  );
}

function FileDialog({ projects, authority, state, presetProjectId, autoUpload, onClose, onSaved }: { projects: { id: string; name: string }[]; authority: Authority; state: string; presetProjectId?: string; autoUpload?: boolean; onClose: () => void; onSaved: () => void }) {
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState<DueDiligenceInput>({ projectId: presetProjectId ?? '', recordType: 'RERA_CERTIFICATE', state, authorityName: authority.name, region: authority.region ?? null });
  function set<K extends keyof DueDiligenceInput>(k: K, v: DueDiligenceInput[K]) { setForm((f) => ({ ...f, [k]: v })); }

  function submit() {
    if (!form.projectId) { toast.error('Pick a project.'); return; }
    setSaving(true);
    saveDueDiligenceRecord(form).then((r) => { setSaving(false); if ('error' in r) { toast.error(r.error); return; } toast.success('Filed to vault'); onSaved(); onClose(); });
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>File from {authority.name}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>Project *</Label>
            <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={form.projectId} onChange={(e) => set('projectId', e.target.value)}><option value="">Select…</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          </div>
          <div className="col-span-2">
            <Label>Record type</Label>
            <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={form.recordType} onChange={(e) => set('recordType', e.target.value)}>{RECORD_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}</select>
          </div>
          <div><Label>Reference no.</Label><Input value={form.reference ?? ''} onChange={(e) => set('reference', e.target.value)} /></div>
          <div><Label>Valid until</Label><Input type="date" value={form.validUntil ?? ''} onChange={(e) => set('validUntil', e.target.value)} /></div>
          <div className="col-span-2">
            <Label>Document</Label>
            <UniversalUploader autoActivate={autoUpload} onUploaded={(f) => set('documentUrl', f.url)} />
          </div>
          <div className="col-span-2"><Label>Note</Label><Input value={form.note ?? ''} onChange={(e) => set('note', e.target.value)} /></div>
        </div>
        <div className="mt-2 flex justify-end"><Button onClick={submit} disabled={saving}>{saving ? 'Filing…' : 'File to vault'}</Button></div>
      </DialogContent>
    </Dialog>
  );
}
