'use client';
import * as React from 'react';
import { LeadStatus } from '@prisma/client';
import { asEnum } from '@/lib/utils/enum';
import { bulkUpdateLeads } from '@/server/actions/bulk';
import { BulkBar, RowCheck } from '@/components/ui/bulk-bar';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { DndContext, PointerSensor, useSensor, useSensors, useDraggable, useDroppable, type DragEndEvent } from '@dnd-kit/core';
import { toast } from 'sonner';
import { Plus, Globe2, LayoutGrid, List as ListIcon } from 'lucide-react';
import { moveLeadStage } from '@/server/actions/sales';
import { NewLeadDialog } from './new-lead-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatCurrency, formatCompactCurrency, titleCase } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

const STAGES = ['NEW', 'CONTACTED', 'QUALIFIED', 'SITE_VISIT', 'NEGOTIATION', 'BOOKED', 'WON', 'LOST'] as const;
type Stage = (typeof STAGES)[number];

interface Lead {
  id: string; reference: string; name: string; status: string; source: string;
  isNri: boolean; country: string | null; ownerName: string | null; projectName: string | null; budgetMax: number | null;
  updatedAt?: string | null;
}

/** A monogram tile from a name — full-width rows read better with an identity anchor. */
function Monogram({ name }: { name: string }) {
  const initials = name.replace(/[^A-Za-z0-9 ]/g, '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
  let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white" style={{ background: `hsl(${h} 45% 45%)` }}>
      {initials}
    </div>
  );
}

/** Colour-coded left accent by stage — green won/booked, red lost, amber hot, else neutral. */
function rowAccent(status: string): string {
  const s = status.toLowerCase();
  if (['won', 'booked'].includes(s)) return 'border-l-emerald-500';
  if (s === 'lost') return 'border-l-red-500';
  if (['negotiation', 'site_visit'].includes(s)) return 'border-l-amber-500';
  if (['qualified', 'contacted'].includes(s)) return 'border-l-blue-500';
  return 'border-l-transparent';
}

function relTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

function LeadRow({ lead, checked, onCheck }: { lead: Lead; checked: boolean; onCheck: (v: boolean) => void }) {
  return (
    <div className={cn('flex items-center gap-3 border-b border-l-2 pl-3 transition-colors hover:bg-muted/40', rowAccent(lead.status))}>
      {/* Outside the Link: a tick box inside an anchor navigates instead of ticking. */}
      <RowCheck checked={checked} onChange={onCheck} label={`Select ${lead.name}`} />
      <Link
        href={`/sales/${lead.id}`}
        className="flex flex-1 items-center gap-3 py-2.5 pr-3"
      >
      <Monogram name={lead.name} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-medium">{lead.name}</span>
          {lead.isNri && <Globe2 className="h-3.5 w-3.5 shrink-0 text-brass" />}
        </div>
        <div className="truncate text-xs text-muted-foreground">
          <span className="font-mono">{lead.reference}</span>{lead.projectName ? ` · ${lead.projectName}` : ''}
        </div>
      </div>
      <div className="hidden shrink-0 items-center gap-2 sm:flex">
        <Badge variant="outline" className="text-[11px]">{titleCase(lead.source)}</Badge>
        {lead.budgetMax ? <span className="tabular-nums text-xs text-muted-foreground">≤ {formatCompactCurrency(lead.budgetMax)}</span> : null}
      </div>
      <StatusBadge status={lead.status} className="shrink-0" />
      <div className="hidden w-28 shrink-0 truncate text-right text-xs text-muted-foreground md:block">
        {lead.ownerName ?? 'Unassigned'}{lead.updatedAt ? ` · ${relTime(lead.updatedAt)}` : ''}
        </div>
      </Link>
    </div>
  );
}

/**
 * The leads list, with bulk actions.
 *
 * ── AMH-014 ────────────────────────────────────────────────────────────────
 *
 * `bulkUpdateLeads` already existed in server/actions/bulk.ts: permission
 * checked, audited, notifying the new owner, and calling
 * `revalidatePath('/sales')` — written for THIS screen and never called from
 * anywhere. Reassigning forty enquiries to a new sales executive meant opening
 * forty leads.
 *
 * The BulkBar and RowCheck primitives existed too, used on exactly one screen.
 */
function LeadListView({ leads, users }: { leads: Lead[]; users: { id: string; name: string }[] }) {
  const router = useRouter();
  const [picked, setPicked] = React.useState<string[]>([]);
  const [pending, start] = React.useTransition();

  const allOn = leads.length > 0 && picked.length === leads.length;
  const toggleAll = (on: boolean) => setPicked(on ? leads.map((l) => l.id) : []);
  const toggle = (id: string, on: boolean) =>
    setPicked((p) => (on ? [...p, id] : p.filter((x) => x !== id)));

  const run = (payload: Record<string, unknown>) =>
    start(async () => {
      const res = await bulkUpdateLeads({ ids: picked, ...payload });
      if ('error' in res) { toast.error(res.error); return; }
      toast.success(res.message);
      setPicked([]);
      router.refresh();
    });

  if (leads.length === 0) return <p className="py-10 text-center text-sm text-muted-foreground">No leads to show.</p>;
  return (
    <>
      <div className="overflow-hidden rounded-lg border">
        <div className="flex items-center gap-3 border-b bg-muted/40 px-3 py-2">
          <RowCheck checked={allOn} onChange={toggleAll} label="Select every lead on this page" />
          <span className="text-xs text-muted-foreground">
            {picked.length ? `${picked.length} selected` : 'Select all'}
          </span>
        </div>
        {leads.map((l) => (
          <LeadRow
            key={l.id}
            lead={l}
            checked={picked.includes(l.id)}
            onCheck={(v) => toggle(l.id, v)}
          />
        ))}
      </div>

      <BulkBar count={picked.length} onClear={() => setPicked([])} busy={pending}>
        <select
          aria-label="Set status"
          className="h-9 rounded-md border bg-background px-2 text-sm"
          defaultValue=""
          onChange={(e) => { if (e.target.value) { run({ action: 'status', status: e.target.value }); e.target.value = ''; } }}
        >
          <option value="" disabled>Set status…</option>
          {STAGES.map((st) => <option key={st} value={st}>{st.replace(/_/g, ' ')}</option>)}
        </select>
        <select
          aria-label="Reassign owner"
          className="h-9 rounded-md border bg-background px-2 text-sm"
          defaultValue=""
          onChange={(e) => { if (e.target.value) { run({ action: 'owner', ownerId: e.target.value }); e.target.value = ''; } }}
        >
          <option value="" disabled>Reassign to…</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <select
          aria-label="Set temperature"
          className="h-9 rounded-md border bg-background px-2 text-sm"
          defaultValue=""
          onChange={(e) => { if (e.target.value) { run({ action: 'temperature', temperature: e.target.value }); e.target.value = ''; } }}
        >
          <option value="" disabled>Mark as…</option>
          {(['HOT', 'WARM', 'COLD'] as const).map((t) => <option key={t} value={t}>{t.toLowerCase()}</option>)}
        </select>
      </BulkBar>
    </>
  );
}

function Card({ lead }: { lead: Lead }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}
      className={cn('cursor-grab rounded-lg border bg-card p-3 shadow-sm active:cursor-grabbing', isDragging && 'opacity-50 ring-2 ring-primary')}>
      <div className="flex items-center justify-between">
        <Link href={`/sales/${lead.id}`} onClick={(e) => e.stopPropagation()} className="text-sm font-medium hover:text-primary">{lead.name}</Link>
        {lead.isNri && <Globe2 className="h-3.5 w-3.5 text-brass" />}
      </div>
      <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{lead.reference}</p>
      {lead.budgetMax && <p className="mt-1 text-xs text-muted-foreground">Budget ≤ {formatCurrency(lead.budgetMax)}</p>}
      <div className="mt-2 flex items-center justify-between">
        <Badge variant="outline" className="text-[11px]">{titleCase(lead.source)}</Badge>
        {lead.ownerName && <span className="text-[11px] text-muted-foreground">{lead.ownerName}</span>}
      </div>
    </div>
  );
}

function Column({ id, leads }: { id: Stage; leads: Lead[] }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div className="flex w-64 shrink-0 flex-col">
      <div className="mb-2 flex items-center justify-between px-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{titleCase(id)}</h3>
        <span className="rounded-full bg-muted px-2 text-xs text-muted-foreground">{leads.length}</span>
      </div>
      <div ref={setNodeRef} className={cn('flex min-h-32 flex-1 flex-col gap-2 rounded-lg border border-dashed p-2', isOver ? 'border-primary bg-primary/5' : 'border-border')}>
        {leads.map((l) => <Card key={l.id} lead={l} />)}
      </div>
    </div>
  );
}

export function SalesPipeline({
  leads: initial, users, projects,
}: {
  leads: Lead[];
  users: { id: string; name: string }[];
  projects: { id: string; name: string }[];
}) {
  const [leads, setLeads] = React.useState(initial);
  /*
   * AMH-045 — "New lead" in the global New menu used to point at `/sales`.
   *
   * It navigated to the board and stopped there, with the dialog closed. The
   * person had picked "New lead" from a menu and then had to find the New lead
   * button on the page they had just been sent to. The menu item looked like it
   * did nothing.
   *
   * It now points at `/sales?new=1` and this opens on arrival. Initialised from
   * the parameter rather than set in an effect, so the dialog is open on the
   * first paint instead of flashing the board first.
   */
  const searchParams = useSearchParams();
  const [newOpen, setNewOpen] = React.useState(() => searchParams.get('new') === '1');
  const [view, setView] = React.useState<'board' | 'list'>('board');
  React.useEffect(() => setLeads(initial), [initial]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const onDragEnd = async (e: DragEndEvent) => {
    const leadId = String(e.active.id);
    const target = e.over?.id as Stage | undefined;
    if (!target) return;
    const cur = leads.find((l) => l.id === leadId);
    if (!cur || cur.status === target) return;
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, status: target } : l)));
    const res = await moveLeadStage(leadId, asEnum(LeadStatus, target, 'NEW'));
    if ('error' in res) { toast.error(res.error); setLeads(initial); }
    else toast.success(`${cur.name} → ${titleCase(target)}`);
  };

  const listLeads = React.useMemo(
    () => [...leads].sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')),
    [leads],
  );

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex overflow-hidden rounded-md border">
          <button
            onClick={() => setView('board')}
            className={cn('flex items-center gap-1.5 px-3 py-1.5 text-sm', view === 'board' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}
          >
            <LayoutGrid className="h-4 w-4" /> Board
          </button>
          <button
            onClick={() => setView('list')}
            className={cn('flex items-center gap-1.5 px-3 py-1.5 text-sm', view === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}
          >
            <ListIcon className="h-4 w-4" /> List
          </button>
        </div>
        <Button size="sm" onClick={() => setNewOpen(true)}><Plus className="h-4 w-4" /> New lead</Button>
      </div>
      {view === 'board' ? (
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {STAGES.map((s) => <Column key={s} id={s} leads={leads.filter((l) => l.status === s)} />)}
          </div>
        </DndContext>
      ) : (
        <LeadListView leads={listLeads} users={users} />
      )}
      <NewLeadDialog open={newOpen} onOpenChange={setNewOpen} users={users} projects={projects} />
    </div>
  );
}
