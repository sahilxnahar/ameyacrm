'use client';

import { cn } from '@/lib/utils/cn';
import { useState, useTransition } from 'react';
import { CheckCircle2, XCircle, MinusCircle, Loader2, Play, AlertTriangle, Database, Lock, KeyRound } from 'lucide-react';
import { checkAiHealth, reindexEverything, catchUpSummaries, testEveryAiKey } from '@/server/actions/vouchers';

interface Probe { name: string; what: string; ok: boolean; ms: number; detail: string; note?: boolean }

interface Coverage { key: string; label: string; permission: string | null; note: string | null; passages: number; records: number }

interface Supply { provider: string; model: string; keyCount: number; hasFallback: boolean }

export function AiHealthView({ indexed, summarised, docs, coverage, supply }: { indexed: number; summarised: number; docs: number; coverage: Coverage[]; supply: Supply }) {
  const [cov, setCov] = useState(coverage);
  const [indexing, startIndex] = useTransition();
  const [indexMsg, setIndexMsg] = useState<string | null>(null);
  const [catchUp, startCatchUp] = useTransition();
  const [catchUpMsg, setCatchUpMsg] = useState<string | null>(null);

  const runCatchUp = () =>
    startCatchUp(async () => {
      setCatchUpMsg(null);
      try {
        const r = await catchUpSummaries();
        setCatchUpMsg(r.message);
      } catch (e) {
        setCatchUpMsg(e instanceof Error ? e.message : 'That did not work.');
      }
    });

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

  /*
   * Every key, one at a time.
   *
   * The self-test above asks the pool a question and reports whether an answer
   * came back — which passes while three of your four spares are dead, because
   * only the first working key is ever tried. Holding four keys is worth
   * something only if you know all four are good.
   */
  type KeyProbe = { label: string; hint: string; ok: boolean; status: number | null; ms: number; verdict: string };
  const [keys, setKeys] = useState<{ provider: string; model: string; keys: KeyProbe[]; fallback: KeyProbe | null; gemini: KeyProbe | null; summary: string } | null>(null);
  const [keysPending, startKeys] = useTransition();
  const testKeys = () =>
    startKeys(async () => {
      setError(null);
      try { setKeys(await testEveryAiKey()); }
      catch (e) { setError(e instanceof Error ? e.message : 'The key test failed to run.'); }
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
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg">Provider &amp; keys</h2>
        </div>
        <p className="text-sm text-muted-foreground">Read live from the server. Keys are never shown — only how many are loaded.</p>
        <div className="mt-4">
          <button
            type="button" onClick={testKeys} disabled={keysPending}
            className="focus-ring inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {keysPending ? 'Testing every key…' : 'Test every key now'}
          </button>
          <p className="mt-1 text-xs text-muted-foreground">
            Sends one tiny request per key. Tells you which are alive, which are out of credit and which
            have been revoked — before the live one runs dry.
          </p>
        </div>

        {keys && (
          <div className="mt-4 space-y-2">
            <p className={cn('rounded-md border p-3 text-sm',
              keys.keys.every((k) => k.ok) && (keys.fallback?.ok || keys.gemini?.ok)
                ? 'border-emerald-500/40 bg-emerald-500/5'
                : keys.keys.some((k) => k.ok) ? 'border-amber-500/40 bg-amber-500/5'
                : 'border-destructive/40 bg-destructive/5')}>
              {keys.summary}
            </p>
            <div className="overflow-hidden rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Key</th>
                    <th className="px-3 py-2 text-left">Which one</th>
                    <th className="px-3 py-2 text-left">Result</th>
                    <th className="px-3 py-2 text-right">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {[...keys.keys, ...(keys.fallback ? [keys.fallback] : []), ...(keys.gemini ? [keys.gemini] : [])].map((k, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-2 font-medium">{k.label}</td>
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{k.hint}</td>
                      <td className={cn('px-3 py-2', k.ok ? 'text-emerald-600' : 'text-destructive')}>
                        <span className="font-semibold">{k.ok ? 'Working' : `Failed${k.status ? ` (${k.status})` : ''}`}</span>
                        <span className="ml-2 text-muted-foreground">{k.verdict}</span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{k.ms}ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <dl className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Provider</dt>
            <dd className="text-lg font-semibold">{supply.provider}</dd>
            <dd className="text-xs text-muted-foreground">model {supply.model}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Keys in rotation</dt>
            <dd className="text-2xl font-semibold tabular-nums">{supply.keyCount}</dd>
            <dd className="text-xs text-muted-foreground">
              {supply.keyCount === 0
                ? 'No key loaded — set AI_API_KEY.'
                : supply.keyCount === 1
                  ? 'One key. Add spares in AI_API_KEYS (comma-separated).'
                  : `${supply.keyCount} keys — one running dry rolls to the next automatically.`}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Fallback provider</dt>
            <dd className="text-lg font-semibold">{supply.hasFallback ? 'Configured' : 'None'}</dd>
            <dd className="text-xs text-muted-foreground">{supply.hasFallback ? 'Used only after every key above fails.' : 'Optional second provider (e.g. Groq).'}</dd>
          </div>
        </dl>
        {supply.keyCount > 1 && (
          <p className="mt-3 flex items-start gap-2 rounded-md bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            Extra keys only add real runway if they belong to <strong>separate</strong> provider accounts. Keys from the same account share one credit balance.
          </p>
        )}
      </div>

      <div className="card-elevated p-5">
        <div className="toolbar items-center gap-3">
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
            {docs > summarised && (
              <div className="mt-2">
                <p className="text-xs text-muted-foreground">
                  {docs - summarised} file{docs - summarised === 1 ? '' : 's'} uploaded before the AI was working, so {docs - summarised === 1 ? 'it has' : 'they have'} no summary.
                </p>
                <button
                  type="button" onClick={runCatchUp} disabled={catchUp}
                  className="focus-ring mt-1.5 inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-60"
                >
                  {catchUp ? <><Loader2 className="h-3 w-3 animate-spin" />Reading them…</> : 'Summarise them now'}
                </button>
                {catchUpMsg && <p className="mt-1.5 text-xs text-emerald-700 dark:text-emerald-400">{catchUpMsg}</p>}
              </div>
            )}
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Passages searchable</dt>
            <dd className="text-2xl font-semibold tabular-nums">{indexed}</dd>
            {indexed === 0 && <p className="mt-1 text-xs text-muted-foreground">Ask Documents needs this above zero to answer anything.</p>}
          </div>
        </dl>
      </div>

      <div className="card-elevated p-5">
        <div className="toolbar items-center gap-3">
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
