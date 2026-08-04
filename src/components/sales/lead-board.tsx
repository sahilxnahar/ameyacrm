'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { GripVertical, Phone, Star } from 'lucide-react';
import { moveLeadStage } from '@/server/actions/sales';
import { cn } from '@/lib/utils/cn';

/**
 * The pipeline as a board: one column per stage, drag a card to move it.
 *
 * Built over the leads that already exist rather than as a second "prospects"
 * table. A lead's stage is one field on one record; giving it a board view is a
 * different way of looking at the same data, not a different dataset. Two tables
 * that both mean "someone who might buy" is how a CRM ends up with the sales
 * team working from one and the reports built on the other.
 *
 * Drag-and-drop is HTML5 native — no library, so this adds nothing to the bundle
 * on a screen people leave open all day. Every move is optimistic and rolls back
 * if the server refuses, because a card that springs back with an explanation is
 * honest, and one that silently stays put is not.
 */
export interface BoardLead {
  id: string;
  name: string;
  reference: string;
  status: string;
  phone: string | null;
  budget: number | null;
  score: number | null;
  ownerName: string | null;
  nextFollowUp: string | null;
}

/** Stage order, with a plain-language name and its colour. */
const STAGES: Array<{ key: string; label: string; bar: string; tint: string }> = [
  { key: 'NEW',         label: 'New',          bar: 'bg-slate-400',   tint: 'bg-slate-500/5' },
  { key: 'CONTACTED',   label: 'Contacted',    bar: 'bg-sky-500',     tint: 'bg-sky-500/5' },
  { key: 'QUALIFIED',   label: 'Qualified',    bar: 'bg-indigo-500',  tint: 'bg-indigo-500/5' },
  { key: 'SITE_VISIT',  label: 'Site visit',   bar: 'bg-amber-500',   tint: 'bg-amber-500/5' },
  { key: 'NEGOTIATION', label: 'Negotiation',  bar: 'bg-orange-500',  tint: 'bg-orange-500/5' },
  { key: 'BOOKED',      label: 'Booked',       bar: 'bg-emerald-500', tint: 'bg-emerald-500/5' },
  { key: 'WON',         label: 'Won',          bar: 'bg-emerald-700', tint: 'bg-emerald-600/8' },
  { key: 'LOST',        label: 'Lost',         bar: 'bg-rose-500',    tint: 'bg-rose-500/5' },
];

const money = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export function LeadBoard({ leads, canMove }: { leads: BoardLead[]; canMove: boolean }) {
  const router = useRouter();
  const [rows, setRows] = React.useState(leads);
  const [dragging, setDragging] = React.useState<string | null>(null);
  const [over, setOver] = React.useState<string | null>(null);
  React.useEffect(() => setRows(leads), [leads]);

  const byStage = React.useMemo(() => {
    const m = new Map<string, BoardLead[]>();
    for (const s of STAGES) m.set(s.key, []);
    for (const l of rows) {
      if (!m.has(l.status)) m.set(l.status, []);
      m.get(l.status)!.push(l);
    }
    return m;
  }, [rows]);

  // The id of the card currently under the cursor, kept in a ref as well as in
  // state. State is what re-renders the card at 40% opacity; the ref is what the
  // drop handler reads, because a ref is correct the instant it is set whereas
  // state is only correct after React has re-rendered. On a fast drag — or a
  // touch device that fires dragstart and drop in the same frame — reading state
  // means reading `null` and silently dropping the move on the floor.
  const draggingRef = React.useRef<string | null>(null);
  const beginDrag = (e: React.DragEvent, id: string) => {
    draggingRef.current = id;
    setDragging(id);
    // Also written to the drag payload so the card survives a re-render mid-drag.
    try { e.dataTransfer.setData('text/plain', id); e.dataTransfer.effectAllowed = 'move'; } catch { /* ignore */ }
  };

  const drop = (e: React.DragEvent, stage: string) => {
    setOver(null);
    let id = draggingRef.current ?? dragging;
    if (!id) { try { id = e.dataTransfer.getData('text/plain') || null; } catch { id = null; } }
    draggingRef.current = null;
    setDragging(null);
    if (!id) return;
    const lead = rows.find((l) => l.id === id);
    if (!lead || lead.status === stage) return;

    const before = lead.status;
    // Move it now; put it back if the server disagrees.
    setRows((p) => p.map((l) => (l.id === id ? { ...l, status: stage } : l)));
    void moveLeadStage(id, stage as never).then((r) => {
      if ('error' in r) {
        setRows((p) => p.map((l) => (l.id === id ? { ...l, status: before } : l)));
        toast.error(r.error);
        return;
      }
      toast.success(`${lead.name} → ${STAGES.find((s) => s.key === stage)?.label ?? stage}`);
      router.refresh();
    }).catch(() => {
      setRows((p) => p.map((l) => (l.id === id ? { ...l, status: before } : l)));
      toast.error('That did not save. Nothing was changed.');
    });
  };


  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
      {/*
       * `items-stretch` is not cosmetic here. Without it a column with no cards
       * collapses to the height of its own header, so the empty stages — the
       * ones you most often need to drag INTO — end up with a drop target a
       * centimetre tall while the busy ones are the full height of the screen.
       * Equal-height columns make every stage equally easy to hit.
       */}
      <div className="flex min-w-max items-stretch gap-3">
        {STAGES.map((s) => {
          const items = byStage.get(s.key) ?? [];
          const value = items.reduce((n, l) => n + (l.budget ?? 0), 0);
          return (
            <section
              key={s.key}
              onDragOver={(e) => { if (canMove) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setOver(s.key); } }}
              onDragLeave={() => setOver((o) => (o === s.key ? null : o))}
              onDrop={(e) => { e.preventDefault(); if (canMove) drop(e, s.key); }}
              className={cn(
                'flex w-[16.5rem] shrink-0 flex-col overflow-hidden rounded-xl border bg-card/50 transition-colors duration-150',
                over === s.key && 'border-primary bg-primary/5 ring-2 ring-primary/30',
              )}
            >
              {/* The stage colour is the top edge of the column itself rather
                  than a bar floating under the title. One line of colour per
                  column reads as a pipeline; eight loose bars read as noise. */}
              <div className={cn('h-[3px] w-full', s.bar)} />
              <header className="px-3 pb-2 pt-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-[13px] font-semibold tracking-tight">{s.label}</h3>
                  <span className="text-xs font-medium tabular-nums text-muted-foreground">{items.length}</span>
                </div>
                {/* Only the money, at the size money deserves. "in this column"
                    was six words explaining a number that sits under its own
                    heading. */}
                <p className={cn('mt-0.5 text-xs tabular-nums', value > 0 ? 'text-muted-foreground' : 'text-transparent')}>
                  {value > 0 ? money(value) : '\u00A0'}
                </p>
              </header>

              <div className={cn('flex-1 space-y-1.5 p-2 pt-0', s.tint)}>
                {items.map((l, i) => (
                  <article
                    key={l.id}
                    draggable={canMove}
                    onDragStart={(e) => beginDrag(e, l.id)}
                    onDragEnd={() => { draggingRef.current = null; setDragging(null); setOver(null); }}
                    style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}
                    className={cn(
                      // Flat by default; the lift is the hover, so a still board
                      // is calm and a board under the cursor is obviously live.
                      'animate-in group rounded-lg border bg-card p-2.5 transition-shadow duration-200',
                      canMove && 'cursor-grab shadow-[0_0_0_rgba(0,0,0,0)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] active:cursor-grabbing',
                      dragging === l.id && 'opacity-40',
                    )}
                  >
                    <div className="flex items-start gap-1.5">
                      {canMove && <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />}
                      <div className="min-w-0 flex-1">
                        <Link href={`/sales/${l.id}`} className="block truncate text-sm font-semibold hover:underline">
                          {l.name}
                        </Link>
                        <p className="truncate font-mono text-[11px] text-muted-foreground">{l.reference}</p>
                      </div>
                      {l.score != null && (
                        <span className="flex shrink-0 items-center gap-0.5 rounded bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                          <Star className="h-2.5 w-2.5 fill-current" />{l.score}
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 space-y-0.5 text-[11px] text-muted-foreground">
                      {l.budget != null && l.budget > 0 && <p className="font-medium text-foreground">{money(l.budget)}</p>}
                      {l.phone && <p className="flex items-center gap-1 truncate"><Phone className="h-2.5 w-2.5" />{l.phone}</p>}
                      {l.ownerName && <p className="truncate">Owner: {l.ownerName}</p>}
                      <p className="truncate">
                        {l.nextFollowUp
                          ? `Follow up ${new Date(l.nextFollowUp).toLocaleDateString('en-IN')}`
                          : 'No follow-up set'}
                      </p>
                    </div>
                  </article>
                ))}
                {!items.length && (
                  <p className="flex min-h-[4.5rem] items-center justify-center rounded-md border border-dashed px-3 text-center text-[11px] text-muted-foreground">
                    {canMove ? `Drag a lead here to mark it ${s.label.toLowerCase()}` : 'Nothing here'}
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
