'use client';
import * as React from 'react';
import Link from 'next/link';
import { DndContext, PointerSensor, useSensor, useSensors, useDraggable, useDroppable, type DragEndEvent } from '@dnd-kit/core';
import { toast } from 'sonner';
import { Plus, Globe2 } from 'lucide-react';
import { moveLeadStage } from '@/server/actions/sales';
import { NewLeadDialog } from './new-lead-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, titleCase } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

const STAGES = ['NEW', 'CONTACTED', 'QUALIFIED', 'SITE_VISIT', 'NEGOTIATION', 'BOOKED', 'WON', 'LOST'] as const;
type Stage = (typeof STAGES)[number];

interface Lead {
  id: string; reference: string; name: string; status: string; source: string;
  isNri: boolean; country: string | null; ownerName: string | null; projectName: string | null; budgetMax: number | null;
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
      <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{lead.reference}</p>
      {lead.budgetMax && <p className="mt-1 text-xs text-muted-foreground">Budget ≤ {formatCurrency(lead.budgetMax)}</p>}
      <div className="mt-2 flex items-center justify-between">
        <Badge variant="outline" className="text-[10px]">{titleCase(lead.source)}</Badge>
        {lead.ownerName && <span className="text-[10px] text-muted-foreground">{lead.ownerName}</span>}
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
  const [newOpen, setNewOpen] = React.useState(false);
  React.useEffect(() => setLeads(initial), [initial]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const onDragEnd = async (e: DragEndEvent) => {
    const leadId = String(e.active.id);
    const target = e.over?.id as Stage | undefined;
    if (!target) return;
    const cur = leads.find((l) => l.id === leadId);
    if (!cur || cur.status === target) return;
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, status: target } : l)));
    const res = await moveLeadStage(leadId, target as never);
    if ('error' in res) { toast.error(res.error); setLeads(initial); }
    else toast.success(`${cur.name} → ${titleCase(target)}`);
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button size="sm" onClick={() => setNewOpen(true)}><Plus className="h-4 w-4" /> New lead</Button>
      </div>
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STAGES.map((s) => <Column key={s} id={s} leads={leads.filter((l) => l.status === s)} />)}
        </div>
      </DndContext>
      <NewLeadDialog open={newOpen} onOpenChange={setNewOpen} users={users} projects={projects} />
    </div>
  );
}
