'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createParkingSlot, bulkCreateParkingSlots, assignParkingSlot, setParkingStatus, deleteParkingSlot, parkingForProject } from '@/server/actions/parking';
import { PARKING_TYPES, PARKING_STATUSES, type ParkingData, type ParkingSlotRow } from '@/lib/parking/types';

const STATUS_STYLE: Record<string, string> = {
  Available: 'border-slate-300 bg-white text-slate-700',
  Assigned: 'border-emerald-400 bg-emerald-50 text-emerald-900',
  Blocked: 'border-rose-300 bg-rose-50 text-rose-800',
};

export function ParkingMatrix({ data: initial }: { data: ParkingData }) {
  const router = useRouter();
  const [data, setData] = React.useState<ParkingData>(initial);
  React.useEffect(() => setData(initial), [initial]);
  const [pending, start] = React.useTransition();
  const [selected, setSelected] = React.useState<ParkingSlotRow | null>(null);
  const [showAdd, setShowAdd] = React.useState(false);

  const t = data.totals;
  const switchProject = (projectId: string) => start(async () => {
    const r = await parkingForProject(projectId);
    if ('error' in r) { toast.error(r.error); return; }
    setData(r.data); setSelected(null);
  });
  const refresh = (projectId: string | null) => start(async () => {
    if (!projectId) return;
    const r = await parkingForProject(projectId);
    if (!('error' in r)) setData(r.data);
  });

  const doAssign = (slot: ParkingSlotRow, unitId: string | null) => start(async () => {
    const r = await assignParkingSlot(slot.id, unitId);
    if ('error' in r) { toast.error(r.error); return; }
    toast.success(unitId ? 'Slot assigned' : 'Slot freed'); refresh(data.projectId); router.refresh(); setSelected(null);
  });
  const doStatus = (slot: ParkingSlotRow, status: string) => start(async () => {
    const r = await setParkingStatus(slot.id, status);
    if ('error' in r) { toast.error(r.error); return; }
    toast.success(`Marked ${status}`); refresh(data.projectId); router.refresh(); setSelected(null);
  });
  const doDelete = (slot: ParkingSlotRow) => start(async () => {
    const r = await deleteParkingSlot(slot.id);
    if ('error' in r) { toast.error(r.error); return; }
    toast.success('Slot deleted'); refresh(data.projectId); router.refresh(); setSelected(null);
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#1B2A4A]">Parking Matrix</h1>
          <p className="text-sm text-muted-foreground">Every parking slot, which level it’s on and which unit it belongs to. Click a slot to assign it, block it or free it.</p>
        </div>
        <button onClick={() => setShowAdd((v) => !v)} className="rounded-md bg-[#1B2A4A] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#243a63]">{showAdd ? 'Close' : 'Add slots'}</button>
      </div>

      {data.projects.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground">Project:</span>
          {data.projects.map((p) => (
            <button key={p.id} onClick={() => switchProject(p.id)} className={`rounded-full px-3 py-1 text-xs ${p.id === data.projectId ? 'bg-[#1B2A4A] text-white' : 'border border-slate-300 bg-white hover:bg-slate-50'}`}>{p.name}</button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Chip label="Total" value={t.total} />
        <Chip label="Available" value={t.available} tone="slate" />
        <Chip label="Assigned" value={t.assigned} tone="emerald" />
        <Chip label="Blocked" value={t.blocked} tone="rose" />
        {t.byType.map((x) => <Chip key={x.type} label={x.type} value={x.count} tone="gold" />)}
      </div>

      {showAdd && <AddSlots data={data} pending={pending} onDone={() => { refresh(data.projectId); router.refresh(); }} />}

      {data.totals.total === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-muted-foreground">
          No parking slots yet for this project. Use <span className="font-semibold">Add slots</span> to create them one by one or generate a whole level at once (e.g. B1-001 … B1-120).
        </div>
      ) : (
        <div className="space-y-5">
          {data.levels.map((lvl) => (
            <div key={lvl.level}>
              <h2 className="mb-2 text-sm font-semibold text-[#1B2A4A]">{lvl.level} <span className="font-normal text-muted-foreground">· {lvl.slots.length} slots</span></h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
                {lvl.slots.map((s) => (
                  <button key={s.id} onClick={() => setSelected(s)} title={s.unitCode ? `Assigned to ${s.unitCode}` : s.status} className={`rounded-md border p-2 text-left text-xs transition hover:ring-2 hover:ring-[#A07D34]/50 ${STATUS_STYLE[s.status] ?? STATUS_STYLE.Available} ${selected?.id === s.id ? 'ring-2 ring-[#1B2A4A]' : ''}`}>
                    <div className="font-semibold">{s.code}</div>
                    <div className="text-[10px] opacity-70">{s.type}</div>
                    {s.unitCode && <div className="mt-0.5 truncate text-[10px] font-medium">→ {s.unitCode}</div>}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-4 text-[11px] text-muted-foreground">
        <Legend cls="border-slate-300 bg-white" label="Available" />
        <Legend cls="border-emerald-400 bg-emerald-50" label="Assigned to a unit" />
        <Legend cls="border-rose-300 bg-rose-50" label="Blocked" />
      </div>

      {selected && (
        <SlotEditor slot={selected} units={data.units} pending={pending} onAssign={doAssign} onStatus={doStatus} onDelete={doDelete} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function Chip({ label, value, tone }: { label: string; value: number; tone?: 'slate' | 'emerald' | 'rose' | 'gold' }) {
  const tones: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-700', emerald: 'bg-emerald-100 text-emerald-800', rose: 'bg-rose-100 text-rose-800', gold: 'bg-[#A07D34]/15 text-[#7a5f28]',
  };
  return <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${tone ? tones[tone] : 'bg-[#1B2A4A] text-white'}`}>{label}<span className="font-bold tabular-nums">{value}</span></span>;
}

function Legend({ cls, label }: { cls: string; label: string }) {
  return <span className="inline-flex items-center gap-1"><span className={`inline-block h-3 w-3 rounded border ${cls}`} />{label}</span>;
}

function AddSlots({ data, pending, onDone }: { data: ParkingData; pending: boolean; onDone: () => void }) {
  const cls = 'rounded border border-slate-300 px-2 py-1 text-sm';
  const [mode, setMode] = React.useState<'one' | 'bulk'>('one');
  const projectId = data.projectId ?? '';

  const submitOne = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const fd = new FormData(e.currentTarget); const form = e.currentTarget;
    (async () => {
      const r = await createParkingSlot({ projectId, code: fd.get('code'), level: fd.get('level') || undefined, type: fd.get('type'), notes: fd.get('notes') || undefined });
      if ('error' in r) { toast.error(r.error); return; }
      toast.success('Slot added'); form.reset(); onDone();
    })();
  };
  const submitBulk = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const fd = new FormData(e.currentTarget);
    (async () => {
      const r = await bulkCreateParkingSlots({ projectId, level: fd.get('level') || undefined, type: fd.get('type'), prefix: fd.get('prefix') || '', start: fd.get('start') || 1, count: fd.get('count'), pad: fd.get('pad') || 0 });
      if ('error' in r) { toast.error(r.error); return; }
      toast.success(`Created ${r.created} slots`); onDone();
    })();
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="mb-2 flex gap-1">
        {(['one', 'bulk'] as const).map((m) => <button key={m} onClick={() => setMode(m)} className={`rounded px-2 py-0.5 text-xs ${m === mode ? 'bg-[#1B2A4A] text-white' : 'bg-white'}`}>{m === 'one' ? 'One slot' : 'Bulk (a whole level)'}</button>)}
      </div>
      {mode === 'one' ? (
        <form onSubmit={submitOne} className="flex flex-wrap items-end gap-2">
          <label className="text-xs">Code<br /><input name="code" required placeholder="B1-023" className={cls} /></label>
          <label className="text-xs">Level<br /><input name="level" placeholder="Basement 1" className={cls} /></label>
          <label className="text-xs">Type<br /><select name="type" className={cls}>{PARKING_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
          <label className="text-xs">Notes<br /><input name="notes" className={cls} /></label>
          <button disabled={pending || !projectId} className="rounded bg-[#1B2A4A] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">Add</button>
        </form>
      ) : (
        <form onSubmit={submitBulk} className="flex flex-wrap items-end gap-2">
          <label className="text-xs">Level<br /><input name="level" placeholder="Basement 1" className={cls} /></label>
          <label className="text-xs">Type<br /><select name="type" className={cls}>{PARKING_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
          <label className="text-xs">Prefix<br /><input name="prefix" placeholder="B1-" className={`${cls} w-24`} /></label>
          <label className="text-xs">Start<br /><input name="start" type="number" defaultValue={1} className={`${cls} w-20`} /></label>
          <label className="text-xs">Count<br /><input name="count" type="number" defaultValue={20} required className={`${cls} w-20`} /></label>
          <label className="text-xs">Pad<br /><input name="pad" type="number" defaultValue={3} title="Zero-pad numbers to this width" className={`${cls} w-16`} /></label>
          <button disabled={pending || !projectId} className="rounded bg-[#1B2A4A] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">Generate</button>
        </form>
      )}
      <p className="mt-1 text-[11px] text-muted-foreground">Bulk example: prefix <code>B1-</code>, start 1, count 120, pad 3 → B1-001 … B1-120.</p>
    </div>
  );
}

function SlotEditor({ slot, units, pending, onAssign, onStatus, onDelete, onClose }: { slot: ParkingSlotRow; units: ParkingData['units']; pending: boolean; onAssign: (s: ParkingSlotRow, unitId: string | null) => void; onStatus: (s: ParkingSlotRow, status: string) => void; onDelete: (s: ParkingSlotRow) => void; onClose: () => void }) {
  const [unitId, setUnitId] = React.useState(slot.unitId ?? '');
  React.useEffect(() => setUnitId(slot.unitId ?? ''), [slot]);
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-xl bg-white p-4 shadow-xl sm:rounded-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[#1B2A4A]">Slot {slot.code}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">✕</button>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">{slot.level} · {slot.type} · currently <span className="font-semibold">{slot.status}</span>{slot.unitCode ? ` (unit ${slot.unitCode})` : ''}</p>

        <label className="mb-1 block text-xs font-semibold">Assign to unit</label>
        <div className="mb-3 flex gap-2">
          <select value={unitId} onChange={(e) => setUnitId(e.target.value)} className="flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm">
            <option value="">— none —</option>
            {units.map((u) => <option key={u.id} value={u.id}>{u.code}{u.typology ? ` · ${u.typology}` : ''}{u.tower ? ` · ${u.tower}` : ''}</option>)}
          </select>
          <button disabled={pending} onClick={() => onAssign(slot, unitId || null)} className="rounded bg-[#1B2A4A] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">Save</button>
        </div>

        <label className="mb-1 block text-xs font-semibold">Status</label>
        <div className="mb-4 flex gap-2">
          {PARKING_STATUSES.map((st) => (
            <button key={st} disabled={pending} onClick={() => onStatus(slot, st)} className={`rounded border px-3 py-1.5 text-sm ${slot.status === st ? 'border-[#1B2A4A] bg-[#1B2A4A] text-white' : 'border-slate-300 bg-white hover:bg-slate-50'}`}>{st}</button>
          ))}
        </div>

        <div className="flex justify-between">
          <button disabled={pending} onClick={() => onDelete(slot)} className="text-sm text-rose-600 hover:underline">Delete slot</button>
          <button onClick={onClose} className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">Close</button>
        </div>
      </div>
    </div>
  );
}
