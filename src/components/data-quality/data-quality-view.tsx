'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils/cn';
import type { QualitySummary, Grade } from '@/lib/dataquality/score';
import type { DuplicatePair } from '@/lib/dataquality/dedupe';
import type { EntityDoc } from '@/config/data-dictionary';

interface EntityQuality {
  key: string;
  label: string;
  summary: QualitySummary;
  duplicates: DuplicatePair[];
}

type Tab = 'quality' | 'duplicates' | 'dictionary';

const gradeColor: Record<Grade, string> = {
  A: 'text-emerald-600', B: 'text-emerald-600', C: 'text-amber-600', D: 'text-destructive',
};

export function DataQualityView({ entities, dictionary }: { entities: EntityQuality[]; dictionary: EntityDoc[] }) {
  const [tab, setTab] = useState<Tab>('quality');
  const [entityKey, setEntityKey] = useState<string>(entities[0]?.key ?? 'lead');
  const active = entities.find((e) => e.key === entityKey) ?? entities[0];

  const totalDupes = entities.reduce((s, e) => s + e.duplicates.length, 0);
  const avg = entities.length ? Math.round(entities.reduce((s, e) => s + e.summary.averageScore, 0) / entities.length) : 100;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-border p-3">
          <div className="text-xs text-muted-foreground">Average quality</div>
          <div className={cn('mt-1 font-display text-2xl font-semibold', avg >= 70 ? 'text-emerald-600' : avg >= 50 ? 'text-amber-600' : 'text-destructive')}>{avg}<span className="text-base">/100</span></div>
        </div>
        {entities.map((e) => (
          <div key={e.key} className="rounded-lg border border-border p-3">
            <div className="text-xs text-muted-foreground">{e.label}</div>
            <div className="mt-1 font-display text-2xl font-semibold">{e.summary.averageScore}</div>
            <div className="text-xs text-muted-foreground">{e.summary.count} records · {e.duplicates.length} dup pairs</div>
          </div>
        ))}
      </div>

      <div className="flex gap-1 border-b border-border">
        {(['quality', 'duplicates', 'dictionary'] as Tab[]).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={cn('focus-ring -mb-px border-b-2 px-3 py-2 text-sm font-medium capitalize', tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground')}>
            {t === 'duplicates' ? `Duplicates${totalDupes ? ` (${totalDupes})` : ''}` : t}
          </button>
        ))}
      </div>

      {tab !== 'dictionary' && (
        <div className="chip-row">
          {entities.map((e) => (
            <button key={e.key} type="button" onClick={() => setEntityKey(e.key)}
              className={cn('focus-ring shrink-0 rounded-full border px-3 py-1 text-xs font-medium', e.key === entityKey ? 'border-primary bg-primary/10 text-primary' : 'border-border')}>{e.label}</button>
          ))}
        </div>
      )}

      {tab === 'quality' && active && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 text-xs">
            {(['A', 'B', 'C', 'D'] as Grade[]).map((g) => (
              <span key={g} className="rounded-full border border-border px-2 py-0.5">
                <span className={cn('font-semibold', gradeColor[g])}>{g}</span> · {active.summary.grades[g]}
              </span>
            ))}
          </div>
          {active.summary.worst.length === 0 ? (
            <Empty text={`Every ${active.label.toLowerCase()} record is complete. Nothing to fix.`} />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr className="text-left"><th className="p-2">Record</th><th className="p-2">Score</th><th className="p-2">Missing</th><th className="p-2">Issues</th></tr>
                </thead>
                <tbody>
                  {active.summary.worst.map((r) => (
                    <tr key={r.id} className="border-t border-border align-top">
                      <td className="p-2">{r.label}</td>
                      <td className={cn('p-2 font-medium', gradeColor[r.grade])}>{r.score}</td>
                      <td className="p-2 text-xs text-muted-foreground">{r.missing.length ? r.missing.join(', ') : '—'}</td>
                      <td className="p-2 text-xs text-destructive">{r.issues.length ? r.issues.join('; ') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-muted-foreground">Showing the {active.summary.worst.length} lowest-scoring records. Score is completeness of the fields this record type depends on, less a penalty for a malformed IFSC, GSTIN, PAN, phone or email.</p>
        </div>
      )}

      {tab === 'duplicates' && active && (
        <div className="space-y-2">
          {active.duplicates.length === 0 ? (
            <Empty text={`No likely duplicate ${active.label.toLowerCase()} found.`} />
          ) : active.duplicates.map((d, i) => (
            <div key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm">
              <div>
                <span className="font-medium">{d.aLabel}</span>
                <span className="mx-2 text-muted-foreground">↔</span>
                <span className="font-medium">{d.bLabel}</span>
                <span className="ml-2 text-xs text-muted-foreground">{d.reason}</span>
              </div>
              <span className={cn('rounded-full px-2 py-0.5 text-xs', d.confidence === 'HIGH' ? 'bg-destructive/10 text-destructive' : 'bg-amber-500/10 text-amber-600')}>{d.confidence === 'HIGH' ? 'likely same' : 'possible'}</span>
            </div>
          ))}
          {active.duplicates.length > 0 && (
            <p className="text-xs text-muted-foreground">These are surfaced for you to judge — nothing is merged automatically. Leads can be merged from the Sales screen; vendor and buyer merges are done by hand for now.</p>
          )}
        </div>
      )}

      {tab === 'dictionary' && (
        <div className="space-y-4">
          {dictionary.map((e) => (
            <div key={e.key} className="rounded-lg border border-border p-4">
              <h3 className="font-display text-lg font-semibold">{e.label} <span className="text-xs font-normal text-muted-foreground">· table {e.table}</span></h3>
              <p className="mt-0.5 text-sm text-muted-foreground">{e.description}</p>
              <p className="mt-0.5 text-xs text-muted-foreground"><span className="font-medium">Source:</span> {e.source}</p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr className="text-left"><th className="py-1 pr-3">Field</th><th className="pr-3">Meaning</th><th className="pr-3">Flags</th></tr>
                  </thead>
                  <tbody>
                    {e.fields.map((f) => (
                      <tr key={f.key} className="border-t border-border align-top">
                        <td className="py-1 pr-3 font-mono text-xs">{f.key}</td>
                        <td className="pr-3">{f.description}</td>
                        <td className="pr-3 text-xs">
                          {f.required && <span className="mr-1 rounded bg-primary/10 px-1.5 py-0.5 text-primary">required</span>}
                          {f.identity && <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">identity</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{text}</div>;
}
