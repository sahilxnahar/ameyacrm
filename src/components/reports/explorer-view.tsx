'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Search, Save, Trash2, FileSpreadsheet, Loader2, Bookmark, Sheet } from 'lucide-react';
import { saveView, deleteView, pushToSheet } from '@/server/actions/views';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface View { id: string; name: string; entity: string; filters: Record<string, string>; isShared: boolean; mine: boolean }
interface Opt { id: string; name: string }
const ENTITIES = [
  { key: 'leads', label: 'Leads' }, { key: 'bookings', label: 'Bookings' },
  { key: 'units', label: 'Inventory' }, { key: 'collections', label: 'Collections' },
];
const STATUS: Record<string, string[]> = {
  leads: ['NEW', 'CONTACTED', 'QUALIFIED', 'SITE_VISIT', 'NEGOTIATION', 'BOOKED', 'WON', 'LOST'],
  bookings: ['TENTATIVE', 'CONFIRMED', 'AGREEMENT', 'REGISTERED', 'CANCELLED'],
  units: ['AVAILABLE', 'HELD', 'BOOKED', 'SOLD', 'BLOCKED'],
  collections: ['PENDING', 'PARTIAL', 'PAID', 'OVERDUE'],
};
const SOURCES = ['WEBSITE', 'REFERRAL', 'WALK_IN', 'CAMPAIGN', 'PORTAL', 'NRI_DESK', 'BROKER', 'OTHER'];
const sel = 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm';
const pretty = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ');

export function ExplorerView({ entity, filters, columns, rows, total, owners, projects, views, canExport }: {
  entity: string; filters: Record<string, string | undefined>; columns: string[]; rows: Record<string, string | number>[];
  total: number; owners: Opt[]; projects: Opt[]; views: View[]; canExport: boolean;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [f, setF] = React.useState<Record<string, string>>({
    status: filters.status ?? '', source: filters.source ?? '', ownerId: filters.ownerId ?? '',
    projectId: filters.projectId ?? '', q: filters.q ?? '', from: filters.from ?? '', to: filters.to ?? '', temperature: filters.temperature ?? '',
  });

  const qs = (e = entity, ff = f) => {
    const p = new URLSearchParams({ entity: e });
    Object.entries(ff).forEach(([k, v]) => { if (v) p.set(k, v); });
    return p.toString();
  };
  const apply = (e = entity) => router.push(`/reports/explorer?${qs(e)}`);
  const applyView = (v: View) => { const nf = { status: '', source: '', ownerId: '', projectId: '', q: '', from: '', to: '', ...v.filters }; setF(nf); router.push(`/reports/explorer?${qs(v.entity, nf)}`); };
  const doSave = () => {
    const name = prompt('Name this view:'); if (!name?.trim()) return;
    const shared = confirm('Share this view with the whole team? (Cancel = keep it private)');
    start(async () => {
      const r = await saveView({ name: name.trim(), entity, filters: Object.fromEntries(Object.entries(f).filter(([, v]) => v)), isShared: shared });
      if ('error' in r) return toast.error(r.error);
      toast.success('View saved'); router.refresh();
    });
  };
  const doDelete = (id: string) => start(async () => { const r = await deleteView(id); if ('error' in r) return toast.error(r.error); toast.success('View deleted'); router.refresh(); });

  const showLeadFilters = entity === 'leads';
  const showDates = entity !== 'units';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {ENTITIES.map((e) => (
          <Button key={e.key} size="sm" variant={entity === e.key ? 'default' : 'outline'} onClick={() => apply(e.key)}>{e.label}</Button>
        ))}
      </div>

      {views.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground"><Bookmark className="mr-1 inline h-3 w-3" />Saved views:</span>
          {views.map((v) => (
            <span key={v.id} className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs hover:bg-secondary/50">
              <button onClick={() => applyView(v)}>{v.name}</button>
              {v.isShared && <Badge variant="secondary" className="h-4 px-1 text-[9px]">shared</Badge>}
              {v.mine && <button onClick={() => doDelete(v.id)} title="Delete"><Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" /></button>}
            </span>
          ))}
        </div>
      )}

      <Card className="p-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="space-y-1"><Label className="text-xs">Status</Label>
            <select className={sel} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
              <option value="">Any</option>{(STATUS[entity] ?? []).map((s) => <option key={s} value={s}>{pretty(s)}</option>)}
            </select></div>
          {showLeadFilters && (
            <>
              <div className="space-y-1"><Label className="text-xs">Source</Label>
                <select className={sel} value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })}>
                  <option value="">Any</option>{SOURCES.map((s) => <option key={s} value={s}>{pretty(s)}</option>)}
                </select></div>
              <div className="space-y-1"><Label className="text-xs">Temperature</Label>
                <select className={sel} value={f.temperature} onChange={(e) => setF({ ...f, temperature: e.target.value })}>
                  <option value="">Any</option>{['HOT', 'WARM', 'COLD'].map((t) => <option key={t} value={t}>{pretty(t)}</option>)}
                </select></div>
              <div className="space-y-1"><Label className="text-xs">Owner</Label>
                <select className={sel} value={f.ownerId} onChange={(e) => setF({ ...f, ownerId: e.target.value })}>
                  <option value="">Anyone</option>{owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select></div>
            </>
          )}
          {(entity === 'units' || showLeadFilters) && (
            <div className="space-y-1"><Label className="text-xs">Project</Label>
              <select className={sel} value={f.projectId} onChange={(e) => setF({ ...f, projectId: e.target.value })}>
                <option value="">Any</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select></div>
          )}
          {showLeadFilters && <div className="space-y-1"><Label className="text-xs">Search</Label><Input value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder="Name, phone, email…" /></div>}
          {showDates && (
            <>
              <div className="space-y-1"><Label className="text-xs">From</Label><Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></div>
              <div className="space-y-1"><Label className="text-xs">To</Label><Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></div>
            </>
          )}
        </div>
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          <Button size="sm" variant="outline" onClick={doSave} disabled={pending}>{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save view</Button>
          {canExport && <Button asChild size="sm" variant="outline"><a href={`/api/reports/explorer.csv?${qs()}`}><FileSpreadsheet className="h-4 w-4" /> Export CSV</a></Button>}
          {canExport && <Button size="sm" variant="outline" disabled={pending} onClick={() => start(async () => { const r = await pushToSheet(entity, Object.fromEntries(Object.entries(f).filter(([, v]) => v))); if ('error' in r) return toast.error(r.error); toast.success(`Pushed ${r.rows} rows to Google Sheets`); })}><Sheet className="h-4 w-4" /> Push to Sheets</Button>}
          <Button size="sm" onClick={() => apply()}><Search className="h-4 w-4" /> Apply</Button>
        </div>
      </Card>

      <p className="text-xs text-muted-foreground">Showing {rows.length} of {total} record{total === 1 ? '' : 's'}.</p>

      <Card className="table-scroll">
        <Table>
          <TableHeader><TableRow>{columns.map((c) => <TableHead key={c}>{pretty(c.replace(/([A-Z])/g, ' $1'))}</TableHead>)}</TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={columns.length} className="py-10 text-center text-sm text-muted-foreground">No records match these filters.</TableCell></TableRow>}
            {rows.map((r, i) => (
              <TableRow key={i}>{columns.map((c) => <TableCell key={c} className="whitespace-nowrap text-sm">{String(r[c] ?? '')}</TableCell>)}</TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
