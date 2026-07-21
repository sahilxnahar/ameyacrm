'use client';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { REPORT_SOURCES, METRICS, sourceByKey } from '@/config/report-sources';
import type { AggResult } from '@/lib/reports/aggregate';
import { runReport, saveReport, deleteReport } from '@/server/actions/reports';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Field, FormGrid } from '@/components/ui/field';
import { StatTile } from '@/components/ui/stat-tile';
import { EmptyState } from '@/components/ui/empty-state';

interface SavedRow { id: string; name: string; source: string; groupBy: string; metric: string; valueKey: string | null; shared: boolean; mine: boolean }

const fmtNum = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 2 });

export function ReportBuilderView({ saved, canBuild }: { saved: SavedRow[]; canBuild: boolean }) {
  const [source, setSource] = useState(REPORT_SOURCES[0]!.key);
  const [groupBy, setGroupBy] = useState(REPORT_SOURCES[0]!.groupBy[0]!.key);
  const [metric, setMetric] = useState('count');
  const [valueKey, setValueKey] = useState('');
  const [name, setName] = useState('');
  const [shared, setShared] = useState(false);
  const [result, setResult] = useState<(AggResult & { ok: boolean; reason?: string }) | null>(null);
  const [pending, start] = useTransition();

  const src = sourceByKey(source)!;
  const needsValue = metric === 'sum' || metric === 'avg';

  function onSourceChange(key: string) {
    const s = sourceByKey(key)!;
    setSource(key);
    setGroupBy(s.groupBy[0]!.key);
    setValueKey(s.values[0]?.key ?? '');
    setResult(null);
  }

  function run() {
    start(async () => {
      const res = await runReport({ source, groupBy, metric, valueKey });
      if ('error' in res) { toast.error(res.error); return; }
      if (!res.result.ok) { toast.error(res.result.reason ?? 'Could not run that report.'); setResult(null); return; }
      setResult(res.result);
    });
  }

  function save() {
    if (name.trim().length < 2) { toast.error('Name the report first.'); return; }
    start(async () => {
      const res = await saveReport({ source, groupBy, metric, valueKey, name, shared: shared ? 'on' : '' });
      if ('error' in res) { toast.error(res.error); return; }
      toast.success(res.message);
      setName('');
    });
  }

  function load(r: SavedRow) {
    setSource(r.source);
    setGroupBy(r.groupBy);
    setMetric(r.metric);
    setValueKey(r.valueKey ?? '');
    start(async () => {
      const res = await runReport({ source: r.source, groupBy: r.groupBy, metric: r.metric, valueKey: r.valueKey ?? '' });
      if ('error' in res) { toast.error(res.error); return; }
      if (!res.result.ok) { toast.error(res.result.reason ?? 'Could not run that report.'); return; }
      setResult(res.result);
    });
  }

  function remove(id: string) {
    start(async () => {
      const res = await deleteReport(id);
      if ('error' in res) { toast.error(res.error); return; }
      toast.success(res.message);
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="space-y-4">
        <Card className="p-4">
          <FormGrid cols={2}>
            <Field label="Source">
              <Select value={source} onChange={(e) => onSourceChange(e.target.value)}>
                {REPORT_SOURCES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </Select>
            </Field>
            <Field label="Group by">
              <Select value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
                {src.groupBy.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
              </Select>
            </Field>
            <Field label="Metric">
              <Select value={metric} onChange={(e) => setMetric(e.target.value)}>
                {METRICS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
              </Select>
            </Field>
            {needsValue && (
              <Field label="Measure field" hint={src.values.length === 0 ? 'This source has no numeric field to measure.' : undefined}>
                <Select value={valueKey} onChange={(e) => setValueKey(e.target.value)}>
                  <option value="">Choose…</option>
                  {src.values.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                </Select>
              </Field>
            )}
          </FormGrid>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={run} disabled={pending}>Run report</Button>
          </div>
        </Card>

        {result && result.rows.length > 0 && (
          <Card className="p-4">
            <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatTile label="Groups" value={String(result.rows.length)} />
              <StatTile label="Total" value={fmtNum(result.total)} />
              <StatTile label="Metric" value={result.metric} />
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={result.rows.slice(0, 25)} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="key" tick={{ fontSize: 11 }} interval={0} angle={-30} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-muted-foreground"><th className="py-1.5">{src.groupBy.find((f) => f.key === groupBy)?.label ?? groupBy}</th><th className="py-1.5 text-right">Count</th><th className="py-1.5 text-right">Value</th></tr></thead>
                <tbody>
                  {result.rows.map((r) => (
                    <tr key={r.key} className="border-b last:border-0"><td className="py-1.5">{r.key}</td><td className="py-1.5 text-right tabular-nums">{r.count}</td><td className="py-1.5 text-right tabular-nums">{fmtNum(r.value)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
        {result && result.rows.length === 0 && (
          <Card className="p-4"><EmptyState title="No data" body="This report has no rows yet — nothing to group." /></Card>
        )}
      </div>

      <div className="space-y-4">
        {canBuild && (
          <Card className="p-4">
            <h3 className="mb-2 text-sm font-semibold">Save this report</h3>
            <Field label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Leads by source" />
            </Field>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} />
              Share with the team
            </label>
            <Button size="sm" className="mt-3 w-full" onClick={save} disabled={pending}>Save report</Button>
          </Card>
        )}
        <Card className="p-4">
          <h3 className="mb-2 text-sm font-semibold">Saved reports</h3>
          {saved.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing saved yet. Build a report and save it here.</p>
          ) : (
            <ul className="space-y-2">
              {saved.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 rounded-md border p-2">
                  <button className="min-w-0 flex-1 text-left" onClick={() => load(r)} disabled={pending}>
                    <div className="truncate text-sm font-medium">{r.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{r.source} · {r.groupBy} · {r.metric}{r.shared ? ' · shared' : ''}</div>
                  </button>
                  {canBuild && r.mine && (
                    <Button size="sm" variant="ghost" onClick={() => remove(r.id)} disabled={pending}>Delete</Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
