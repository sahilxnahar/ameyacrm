'use client';

import * as React from 'react';
import type { SandboxData } from '@/server/services/sandbox-service';
import { sandboxSetUnitStatus } from '@/server/actions/sandbox';
import { PageHead, ResetButton, useRunner, inr, Kpi } from './demo-shared';

const STATUSES = ['AVAILABLE', 'HELD', 'BOOKED'] as const;

export function DemoInventory({ data }: { data: SandboxData }) {
  const [pending, run] = useRunner();
  const [tower, setTower] = React.useState<string>('all');

  const towers = [...new Set(data.units.map((u) => u.tower))];
  const shown = tower === 'all' ? data.units : data.units.filter((u) => u.tower === tower);

  const tone = (s: string) =>
    s === 'AVAILABLE' ? 'bg-emerald-500/15 text-emerald-600'
    : s === 'HELD' ? 'bg-amber-500/15 text-amber-600'
    : 'bg-rose-500/15 text-rose-600';

  const count = (s: string) => data.units.filter((u) => u.status === s).length;

  return (
    <div>
      <PageHead title="Inventory" blurb="Every flat, and where it stands. Hold one for a buyer, or mark it booked.">
        <ResetButton />
      </PageHead>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Total flats" value={String(data.units.length)} />
        <Kpi label="Available" value={String(count('AVAILABLE'))} />
        <Kpi label="On hold" value={String(count('HELD'))} />
        <Kpi label="Booked" value={String(count('BOOKED'))} />
      </div>

      <div className="mb-3 flex flex-wrap gap-1">
        {['all', ...towers].map((t) => (
          <button
            key={t} type="button" onClick={() => setTower(t)}
            className={`focus-ring rounded-md px-2.5 py-1 text-xs font-medium ${tower === t ? 'bg-primary text-primary-foreground' : 'border bg-background hover:bg-secondary'}`}
          >
            {t === 'all' ? 'All towers' : t}
          </button>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {shown.map((u) => (
          <div key={u.id} className="rounded-lg border bg-background p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{u.number}</p>
                <p className="text-xs text-muted-foreground">{u.tower} · {u.typology}</p>
                <p className="text-xs text-muted-foreground">{u.areaSqft} sq ft</p>
              </div>
              <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${tone(u.status)}`}>{u.status}</span>
            </div>
            <p className="mt-2 font-display">{inr(u.price)}</p>
            <div className="mt-2 flex gap-1">
              {STATUSES.map((s) => (
                <button
                  key={s} type="button" disabled={pending || u.status === s}
                  onClick={() => run(() => sandboxSetUnitStatus(u.id, s), `${u.number} → ${s.toLowerCase()}`)}
                  className="focus-ring flex-1 rounded border px-1.5 py-1 text-[11px] hover:bg-secondary disabled:opacity-40"
                >
                  {s === 'AVAILABLE' ? 'Free' : s === 'HELD' ? 'Hold' : 'Book'}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
