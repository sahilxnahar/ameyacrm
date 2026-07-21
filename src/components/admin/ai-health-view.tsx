'use client';

import { useState, useTransition } from 'react';
import { CheckCircle2, XCircle, MinusCircle, Loader2, Play, AlertTriangle, Database, Lock } from 'lucide-react';
import { checkAiHealth, reindexEverything } from '@/server/actions/vouchers';

interface Probe { name: string; what: string; ok: boolean; ms: number; detail: string; note?: boolean }

interface Coverage { key: string; label: string; permission: string | null; note: string | null; passages: number; records: number }

export function AiHealthView({ indexed, summarised, docs, coverage }: { indexed: number; summarised: number; docs: number; coverage: Coverage[] }) {
  const [cov, setCov] = useState(coverage);
  const [indexing, startIndex] = useTransition();
  const [indexMsg, setIndexMsg] = useState<string | null>(null);

  const runIndex = () =>
    startIndex(async () => {
      setIndexMsg(null);
      try {
        const { reports } = await reindexEverything();
        const total = reports.reduce((n, r) => n + r.indexed, 0);
        const failed = reports.filter((r) => r.error);
        setIndexMsg(
          failed.length
            ? `Indexed ${total} records, but ${failed.map((f) => f.label).join(', ')} failed.`
            : `Indexed ${total} records across ${reports.length} sources. Reload to see the new counts.`,
        );
        setCov((c) => c.map((x) => { const r = reports.find((y) => y.source === x.key); return r && r.indexed ? { ...x, records: r.indexed } : x; }));
      } catch (e) {
        setIndexMsg(e instanceof Error ? e.message : 'Indexing failed.');
      }
    });
  const [result, setResult] = useState<{ enabled: boolean; model: string; provider: string; probes: Probe[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = () =>
    start(async () => {
      setError(null);
      try { setResult(await checkAiHealth()); }
      catch (e) { setError(e instanceof Error ? e.message : 'The check itself failed to run.'); }
    });

  // Known limitations of the chosen provider are not failures, and counting
  // them as such made a working setup look broken.
  const real = result?.probes.filter((p) => !p.note) ?? [];
  const passed = real.filter((p) => p.ok).length;
  const total = real.length;
  const notes = result?.probes.filter((p) => p.note).length ?? 0;

  return (
    <div className="space-y-5">
      <div className="card-elevated p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg">Live check</h2>
            <p className="text-sm text-muted-foreground">
              Sends four real requests to Google. Takes a few seconds and uses a tiny amount of your free quota.
            </p>
          </div>
          <button
            type="button" onClick={run} disabled={pending}
            className="focus-ring inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {pending ? <><Loader2 className="h-4 w-4 animate-spin" />Testing…</> : <><Play className="h-4 w-4" />Run the check</>}
          </button>
        </div>

        {error && (
          <p className="mt-4 flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}
          </p>
        )}

        {result && (
          <div className="mt-5 space-y-3">
            <div className={`rounded-md p-3 text-sm ${passed === total ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-300'}`}>
              <strong>{passed} of {total} checks passed{notes ? `, ${notes} not available on this provider` : ''}.</strong>{' '}
              {passed === total
                ? `The AI is working — ${result.provider}, model ${result.model}.`
                : `Running on ${result.provider} (${result.model}). Look at the failures below — each one says what to do about it.`}
            </div>
            <ul className="divide-y rounded-md border">
              {result.probes.map((p) => (
                <li key={p.name} className="flex items-start gap-3 p-3">
                  {p.ok
                    ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                    : p.note
                      ? <MinusCircle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                      : <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{p.name}</p>
                    <p className="text-sm text-muted-foreground">{p.what}</p>
                    <p className={`mt-1 text-sm ${p.ok ? '' : p.note ? 'text-muted-foreground' : 'text-destructive'}`}>{p.detail}</p>
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{p.ms} ms</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="card-elevated p-5">
        <h2 className="font-display text-lg">What the AI has actually done here</h2>
        <p className="text-sm text-muted-foreground">Counted from your database, not from settings.</p>
        <dl className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Documents uploaded</dt>
            <dd className="text-2xl font-semibold tabular-nums">{docs}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Summarised by AI</dt>
            <dd className="text-2xl font-semibold tabular-nums">{summarised}</dd>
            {docs > 0 && summarised === 0 && <p className="mt-1 text-xs text-amber-700 dark:text-amber-500">Nothing summarised yet. File summaries need a provider that reads PDFs and images.</p>}
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Passages searchable</dt>
            <dd className="text-2xl font-semibold tabular-nums">{indexed}</dd>
            {indexed === 0 && <p className="mt-1 text-xs text-muted-foreground">Ask Documents needs this above zero to answer anything.</p>}
          </div>
        </dl>
      </div>

      <div className="card-elevated p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg">What the AI can see</h2>
            <p className="text-sm text-muted-foreground">
              Everything is indexed once. Each person is then answered only from the rows they are allowed to open.
            </p>
          </div>
          <button
            type="button" onClick={runIndex} disabled={indexing}
            className="focus-ring inline-flex items-center gap-2 rounded-md border bg-background px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
          >
            {indexing ? <><Loader2 className="h-4 w-4 animate-spin" />Indexing…</> : <><Database className="h-4 w-4" />Index everything</>}
          </button>
        </div>
        {indexMsg && <p className="mt-3 rounded-md bg-muted p-3 text-sm">{indexMsg}</p>}
        <ul className="mt-4 divide-y rounded-md border">
          {cov.map((c) => (
            <li key={c.key} className="flex flex-wrap items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{c.label}</p>
                <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  {c.permission ? (
                    <><Lock className="h-3 w-3" />Only people with <code className="rounded bg-muted px-1">{c.permission}</code></>
                  ) : (
                    'Everyone, subject to folder locks'
                  )}
                  {c.note ? ` · ${c.note}` : ''}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold tabular-nums">{c.records}</p>
                <p className="text-xs text-muted-foreground">{c.passages} passages</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="card-elevated p-5">
        <h2 className="font-display text-lg">Where the AI is used</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li><strong className="text-foreground">Payments</strong> — reads a bank SMS and fills in the UTR, amount and date.</li>
          <li><strong className="text-foreground">Billing</strong> — reads a supplier bill into an invoice.</li>
          <li><strong className="text-foreground">Documents</strong> — summarises every file you upload.</li>
          <li><strong className="text-foreground">Ask Documents</strong> — answers from files, leads, bookings, invoices, tasks and (for finance) payments.</li>
          <li><strong className="text-foreground">Leads</strong> — scores a lead and suggests the next step.</li>
          <li><strong className="text-foreground">Voice notes</strong> — turns a site recording into a task.</li>
        </ul>
        <p className="mt-3 text-sm text-muted-foreground">
          If the check above passes and one of these still misbehaves, the fault is in that feature, not the AI key.
        </p>
      </div>
    </div>
  );
}
