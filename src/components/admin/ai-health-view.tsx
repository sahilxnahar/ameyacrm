'use client';

import { useState, useTransition } from 'react';
import { CheckCircle2, XCircle, Loader2, Play, AlertTriangle } from 'lucide-react';
import { checkAiHealth } from '@/server/actions/vouchers';

interface Probe { name: string; what: string; ok: boolean; ms: number; detail: string }

export function AiHealthView({ indexed, summarised, docs }: { indexed: number; summarised: number; docs: number }) {
  const [result, setResult] = useState<{ enabled: boolean; model: string; probes: Probe[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = () =>
    start(async () => {
      setError(null);
      try { setResult(await checkAiHealth()); }
      catch (e) { setError(e instanceof Error ? e.message : 'The check itself failed to run.'); }
    });

  const passed = result?.probes.filter((p) => p.ok).length ?? 0;
  const total = result?.probes.length ?? 0;

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
              <strong>{passed} of {total} checks passed.</strong>{' '}
              {passed === total
                ? `The AI is working. Model in use: ${result.model}.`
                : 'Look at the failures below — each one says what to do about it.'}
            </div>
            <ul className="divide-y rounded-md border">
              {result.probes.map((p) => (
                <li key={p.name} className="flex items-start gap-3 p-3">
                  {p.ok
                    ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                    : <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{p.name}</p>
                    <p className="text-sm text-muted-foreground">{p.what}</p>
                    <p className={`mt-1 text-sm ${p.ok ? '' : 'text-destructive'}`}>{p.detail}</p>
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
            {docs > 0 && summarised === 0 && <p className="mt-1 text-xs text-amber-700 dark:text-amber-500">Nothing summarised yet — a sign the key is not reaching Google.</p>}
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Passages searchable</dt>
            <dd className="text-2xl font-semibold tabular-nums">{indexed}</dd>
            {indexed === 0 && <p className="mt-1 text-xs text-muted-foreground">Ask Documents needs this above zero to answer anything.</p>}
          </div>
        </dl>
      </div>

      <div className="card-elevated p-5">
        <h2 className="font-display text-lg">Where the AI is used</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li><strong className="text-foreground">Payments</strong> — reads a bank SMS and fills in the UTR, amount and date.</li>
          <li><strong className="text-foreground">Billing</strong> — reads a supplier bill into an invoice.</li>
          <li><strong className="text-foreground">Documents</strong> — summarises every file you upload.</li>
          <li><strong className="text-foreground">Ask Documents</strong> — answers questions from your own files.</li>
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
