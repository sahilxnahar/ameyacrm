'use client';
import * as React from 'react';
import Link from 'next/link';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  isSameMonth, isSameDay, isToday, addMonths, isBefore, startOfDay,
} from 'date-fns';
import { ChevronLeft, ChevronRight, CheckSquare, BellRing, Inbox, IndianRupee, CalendarDays, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';

type WorkKind = 'TASK' | 'REMINDER' | 'APPROVAL' | 'COLLECTION' | 'EVENT';
interface WorkItem {
  id: string; kind: WorkKind; title: string; detail?: string; due: string;
  ownerId: string | null; ownerName: string | null; href: string; priority?: string; amount?: number;
}
interface WorkloadRow {
  userId: string; name: string; departmentName: string | null;
  overdue: number; today: number; next7: number; later: number; total: number; nextDue: string | null;
}

const KIND: Record<WorkKind, { label: string; icon: React.ElementType; dot: string; text: string }> = {
  TASK:       { label: 'Task',       icon: CheckSquare,  dot: 'bg-blue-500',    text: 'text-blue-600' },
  REMINDER:   { label: 'Follow-up',  icon: BellRing,     dot: 'bg-amber-500',   text: 'text-amber-600' },
  APPROVAL:   { label: 'Approval',   icon: Inbox,        dot: 'bg-purple-500',  text: 'text-purple-600' },
  COLLECTION: { label: 'Collection', icon: IndianRupee,  dot: 'bg-emerald-600', text: 'text-emerald-700' },
  EVENT:      { label: 'Meeting',    icon: CalendarDays, dot: 'bg-slate-500',   text: 'text-slate-600' },
};

const money = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export function CalendarView({
  items, workload, users, meId, canSeeEveryone,
}: {
  items: WorkItem[]; workload: WorkloadRow[];
  users: { id: string; name: string }[];
  meId: string; canSeeEveryone: boolean;
}) {
  const [month, setMonth] = React.useState(() => startOfMonth(new Date()));
  const [who, setWho] = React.useState<string>(canSeeEveryone ? 'all' : meId);
  const [kinds, setKinds] = React.useState<Set<WorkKind>>(new Set(Object.keys(KIND) as WorkKind[]));
  const [selected, setSelected] = React.useState<Date | null>(new Date());
  const [tab, setTab] = React.useState<'calendar' | 'workload'>('calendar');

  const visible = React.useMemo(
    () => items.filter((i) => kinds.has(i.kind) && (who === 'all' || i.ownerId === who)),
    [items, kinds, who],
  );

  const byDay = React.useMemo(() => {
    const m = new Map<string, WorkItem[]>();
    visible.forEach((i) => {
      const k = format(new Date(i.due), 'yyyy-MM-dd');
      m.set(k, [...(m.get(k) ?? []), i]);
    });
    return m;
  }, [visible]);

  const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }) });
  const dayItems = selected ? byDay.get(format(selected, 'yyyy-MM-dd')) ?? [] : [];
  const overdue = visible.filter((i) => isBefore(new Date(i.due), startOfDay(new Date())));

  const toggleKind = (k: WorkKind) =>
    setKinds((prev) => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {canSeeEveryone && (
          <>
            <Button size="sm" variant={tab === 'calendar' ? 'default' : 'outline'} onClick={() => setTab('calendar')}>Calendar</Button>
            <Button size="sm" variant={tab === 'workload' ? 'default' : 'outline'} onClick={() => setTab('workload')}>Who has what</Button>
            <select className="h-8 rounded-md border border-input bg-background px-2 text-xs" value={who} onChange={(e) => setWho(e.target.value)}>
              <option value="all">Everyone</option>
              <option value={meId}>Just me</option>
              {users.filter((u) => u.id !== meId).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </>
        )}
        <span className="ml-auto flex flex-wrap gap-1">
          {(Object.keys(KIND) as WorkKind[]).map((k) => {
            const K = KIND[k];
            return (
              <button key={k} onClick={() => toggleKind(k)} title={`Show or hide ${K.label.toLowerCase()}s`}
                className={cn('flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs transition-opacity', !kinds.has(k) && 'opacity-40')}>
                <span className={cn('h-2 w-2 rounded-full', K.dot)} /> {K.label}
              </button>
            );
          })}
        </span>
      </div>

      {overdue.length > 0 && (
        <Card className="flex items-center gap-2 border-destructive/40 bg-destructive/5 p-3 text-sm">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <span><span className="font-semibold">{overdue.length}</span> {overdue.length === 1 ? 'item is' : 'items are'} past their date{who === 'all' ? ' across the team' : ''}.</span>
        </Card>
      )}

      {tab === 'workload' && canSeeEveryone ? (
        <WorkloadTable rows={workload} onPick={(id) => { setWho(id); setTab('calendar'); }} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
          <Card className="p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-display text-lg font-semibold">{format(month, 'MMMM yyyy')}</p>
              <span className="flex gap-1">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setMonth(startOfMonth(new Date())); setSelected(new Date()); }}>Today</Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setMonth(addMonths(month, 1))} aria-label="Next month"><ChevronRight className="h-4 w-4" /></Button>
              </span>
            </div>
            <div className="grid grid-cols-7 gap-px text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="py-1">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md border bg-border">
              {days.map((d) => {
                const list = byDay.get(format(d, 'yyyy-MM-dd')) ?? [];
                const late = list.some((i) => isBefore(new Date(i.due), startOfDay(new Date())));
                return (
                  <button key={d.toISOString()} onClick={() => setSelected(d)}
                    className={cn('min-h-[76px] bg-card p-1.5 text-left align-top transition-colors hover:bg-secondary/60',
                      !isSameMonth(d, month) && 'opacity-40',
                      selected && isSameDay(d, selected) && 'ring-2 ring-inset ring-primary')}>
                    <span className={cn('inline-flex h-5 w-5 items-center justify-center rounded-full text-xs',
                      isToday(d) && 'bg-primary font-semibold text-primary-foreground')}>{format(d, 'd')}</span>
                    <span className="mt-1 flex flex-wrap gap-0.5">
                      {list.slice(0, 6).map((i) => <span key={i.id} className={cn('h-1.5 w-1.5 rounded-full', KIND[i.kind].dot)} />)}
                      {list.length > 6 && <span className="text-[9px] text-muted-foreground">+{list.length - 6}</span>}
                    </span>
                    {late && <span className="mt-0.5 block text-[9px] font-medium text-destructive">late</span>}
                  </button>
                );
              })}
            </div>
          </Card>

          <Card className="p-3">
            <p className="mb-2 text-sm font-semibold">{selected ? format(selected, 'EEEE d MMMM') : 'Pick a day'}</p>
            {dayItems.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nothing due.</p>
            ) : (
              <ul className="space-y-2">
                {dayItems.map((i) => {
                  const K = KIND[i.kind];
                  const Icon = K.icon;
                  return (
                    <li key={i.id}>
                      <Link href={i.href} className="flex gap-2 rounded-md p-2 hover:bg-secondary">
                        <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', K.text)} />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">{i.title}</span>
                          <span className="block text-xs text-muted-foreground">
                            {[format(new Date(i.due), 'HH:mm'), i.detail, i.ownerName].filter(Boolean).join(' · ')}
                          </span>
                          {i.amount !== undefined && <Badge variant="secondary" className="mt-1">{money(i.amount)}</Badge>}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

function WorkloadTable({ rows, onPick }: { rows: WorkloadRow[]; onPick: (userId: string) => void }) {
  const [sort, setSort] = React.useState<'overdue' | 'total' | 'name'>('overdue');
  const sorted = [...rows].sort((a, b) =>
    sort === 'name' ? a.name.localeCompare(b.name) : sort === 'total' ? b.total - a.total : b.overdue - a.overdue || b.total - a.total);

  return (
    <Card className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="cursor-pointer p-3" onClick={() => setSort('name')}>Person</th>
            <th className="p-3">Department</th>
            <th className="cursor-pointer p-3 text-right text-destructive" onClick={() => setSort('overdue')}>Overdue</th>
            <th className="p-3 text-right">Today</th>
            <th className="p-3 text-right">Next 7 days</th>
            <th className="p-3 text-right">Later</th>
            <th className="cursor-pointer p-3 text-right" onClick={() => setSort('total')}>Total</th>
            <th className="p-3">Next due</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.userId} className="cursor-pointer border-b last:border-0 hover:bg-secondary/50" onClick={() => onPick(r.userId)}
              title={`See ${r.name}'s calendar`}>
              <td className="p-3 font-medium">{r.name}</td>
              <td className="p-3 text-muted-foreground">{r.departmentName ?? '—'}</td>
              <td className={cn('p-3 text-right font-semibold', r.overdue > 0 ? 'text-destructive' : 'text-muted-foreground')}>{r.overdue}</td>
              <td className="p-3 text-right">{r.today}</td>
              <td className="p-3 text-right">{r.next7}</td>
              <td className="p-3 text-right text-muted-foreground">{r.later}</td>
              <td className="p-3 text-right font-medium">{r.total}</td>
              <td className="p-3 text-xs text-muted-foreground">{r.nextDue ? format(new Date(r.nextDue), 'd MMM, HH:mm') : '—'}</td>
            </tr>
          ))}
          {sorted.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No active people yet.</td></tr>}
        </tbody>
      </table>
    </Card>
  );
}
