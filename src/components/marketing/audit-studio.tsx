'use client';

import { useState, useTransition } from 'react';
import { Loader2, Search, AlertTriangle, ArrowRight, Copy, Check, Save } from 'lucide-react';
import { runMarketingAudit, saveGeneratedAds } from '@/server/actions/marketing-audit';
import { AUDIT_KINDS, type AuditKind, type AuditResult, type Finding } from '@/config/marketing-audits';

interface Recent {
  id: string; kind: string; url: string; hostname: string;
  score: number | null; summary: string | null; error: string | null; when: string;
}

const SEV: Record<string, string> = {
  high: 'border-destructive/40 bg-destructive/5',
  medium: 'border-amber-400/40 bg-amber-50/60 dark:bg-amber-950/20',
  low: 'border-border bg-muted/30',
};
const SEV_TEXT: Record<string, string> = {
  high: 'text-destructive',
  medium: 'text-amber-700 dark:text-amber-500',
  low: 'text-muted-foreground',
};

const scoreTone = (n: number) =>
  n >= 75 ? 'text-emerald-600' : n >= 50 ? 'text-amber-600' : 'text-destructive';

export function AuditStudio({ defaultUrl, recent }: { defaultUrl: string; recent: Recent[] }) {
  const [kind, setKind] = useState<AuditKind>('LANDING');
  const [url, setUrl] = useState(defaultUrl);
  const [rival, setRival] = useState('');
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = () =>
    start(async () => {
      setError(null); setResult(null); setSaved(null);
      const res = await runMarketingAudit({ kind, url, compareTo: rival });
      if ('error' in res) { setError(res.error); return; }
      if (res.result.error) { setError(res.result.error); return; }
      setResult(res.result);
    });

  const keepAds = () =>
    start(async () => {
      if (!result) return;
      const res = await saveGeneratedAds(result.id);
      setSaved('error' in res ? res.error : res.message);
    });

  const chosen = AUDIT_KINDS.find((k) => k.key === kind);
  const ads = result?.kind === 'ADS'
    ? (result.output as { google?: Array<{ headline: string; description: string }>; meta?: Array<{ headline: string; body: string }> } | null)
    : null;
  const comp = result?.kind === 'COMPETITORS'
    ? (result.output as { theyDoBetter?: string[]; weDoBetter?: string[]; steal?: string[] } | null)
    : null;

  return (
    <div className="space-y-5">
      <div className="card-elevated space-y-4 p-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {AUDIT_KINDS.map((k) => (
            <button
              key={k.key} type="button" onClick={() => setKind(k.key)}
              className={`focus-ring rounded-lg border p-3 text-left transition-colors ${kind === k.key ? 'border-primary bg-secondary/60' : 'hover:bg-muted/50'}`}
            >
              <p className="text-sm font-medium">{k.label}</p>
            </button>
          ))}
        </div>
        {chosen && <p className="text-sm text-muted-foreground">{chosen.blurb}</p>}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">{kind === 'COMPETITORS' ? 'Our page' : 'Page to check'}</span>
            <input
              value={url} onChange={(e) => setUrl(e.target.value)} inputMode="url"
              placeholder="https://www.ameyaheights.com"
              className="focus-ring mt-1 w-full rounded-md border bg-background px-3 py-2 text-base"
            />
          </label>
          {kind === 'COMPETITORS' && (
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Their page</span>
              <input
                value={rival} onChange={(e) => setRival(e.target.value)} inputMode="url"
                placeholder="https://another-builder.com"
                className="focus-ring mt-1 w-full rounded-md border bg-background px-3 py-2 text-base"
              />
            </label>
          )}
        </div>

        <button
          type="button" onClick={run} disabled={pending || url.trim().length < 4}
          className="focus-ring inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {pending ? <><Loader2 className="h-4 w-4 animate-spin" />Reading the page…</> : <><Search className="h-4 w-4" />Run the audit</>}
        </button>
        <p className="text-xs text-muted-foreground">
          The page is fetched and read as written — nothing is guessed. A page that needs JavaScript to show its text cannot be read this way.
        </p>
      </div>

      {error && (
        <p className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}
        </p>
      )}

      {result && (
        <div className="space-y-4">
          <div className="card-elevated flex flex-wrap items-center gap-4 p-4">
            {result.score != null && (
              <div className="text-center">
                <p className={`text-4xl font-semibold tabular-nums ${scoreTone(result.score)}`}>{result.score}</p>
                <p className="text-xs text-muted-foreground">out of 100</p>
              </div>
            )}
            <p className="min-w-0 flex-1 text-sm">{result.summary}</p>
          </div>

          {result.findings.length > 0 && (
            <div className="space-y-2">
              {result.findings.map((f: Finding, i) => (
                <div key={i} className={`rounded-lg border p-4 ${SEV[f.severity]}`}>
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    <span className={`text-xs uppercase tracking-wide ${SEV_TEXT[f.severity]}`}>{f.severity}</span>
                    {f.title}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{f.detail}</p>
                  {f.fix && (
                    <p className="mt-2 flex gap-2 text-sm">
                      <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{f.fix}</span>
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {comp && (
            <div className="grid gap-3 sm:grid-cols-3">
              {([['They do better', comp.theyDoBetter], ['We do better', comp.weDoBetter], ['Worth copying', comp.steal]] as const).map(([label, list]) => (
                <div key={label} className="card-elevated p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">
                    {(list ?? []).map((x, i) => <li key={i}>{x}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {ads && (
            <div className="space-y-3">
              {([['Google Search', ads.google, 30, 90], ['Facebook / Instagram', ads.meta, 40, 125]] as const).map(([label, list, hMax, bMax]) => (
                <div key={label} className="card-elevated p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
                  <div className="mt-2 space-y-2">
                    {(list ?? []).map((ad: Record<string, string>, i: number) => {
                      const body = ad.description ?? ad.body ?? '';
                      const text = `${ad.headline}\n${body}`;
                      return (
                        <div key={i} className="rounded-md border p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-medium text-primary">{ad.headline}</p>
                              <p className="text-sm text-muted-foreground">{body}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => { navigator.clipboard.writeText(text); setCopied(`${label}${i}`); setTimeout(() => setCopied(null), 1500); }}
                              className="focus-ring shrink-0 rounded-md border p-1.5 hover:bg-muted"
                              aria-label="Copy this ad"
                            >
                              {copied === `${label}${i}` ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                          <p className="mt-1.5 text-xs tabular-nums text-muted-foreground">
                            headline {ad.headline?.length ?? 0}/{hMax} · body {body.length}/{bMax}
                            {(ad.headline?.length ?? 0) > hMax || body.length > bMax
                              ? <span className="ml-1 text-amber-700 dark:text-amber-500">— over the limit, trim before using</span>
                              : ''}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                  </div>
              ))}
              <button
                type="button" onClick={keepAds} disabled={pending}
                className="focus-ring inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted disabled:opacity-60"
              >
                <Save className="h-4 w-4" />Save these as templates
              </button>
              {saved && <p className="text-sm text-emerald-700 dark:text-emerald-400">{saved}</p>}
            </div>
          )}
        </div>
      )}

      {recent.length > 0 && !result && (
        <div className="card-elevated divide-y">
          <p className="p-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Earlier audits</p>
          {recent.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 p-3">
              <span className="rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">{r.kind}</span>
              <span className="min-w-0 flex-1 truncate text-sm">{r.hostname}</span>
              {r.error
                ? <span className="text-xs text-destructive">failed</span>
                : r.score != null && <span className={`text-sm font-semibold tabular-nums ${scoreTone(r.score)}`}>{r.score}</span>}
              <span className="text-xs text-muted-foreground">{new Date(r.when).toLocaleDateString('en-IN')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
