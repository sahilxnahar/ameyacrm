'use client';
import * as React from 'react';
import { toast } from 'sonner';
import { Send, Copy, KeyRound, ShieldAlert, FileJson, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import type { ApiEndpoint } from '@/lib/api/openapi';

const METHOD_TONE: Record<string, string> = {
  GET: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  POST: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  PATCH: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  DELETE: 'bg-red-500/15 text-red-600 dark:text-red-400',
};

export function ApiPlayground({ endpoints, groups, tokens }: {
  endpoints: ApiEndpoint[];
  groups: string[];
  tokens: Array<{ id: string; name: string; prefix: string }>;
}) {
  const [sel, setSel] = React.useState<ApiEndpoint>(endpoints[0]!);
  const [token, setToken] = React.useState('');
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [resp, setResp] = React.useState<{ status: number; body: string } | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    // Seed body inputs from the sample when switching endpoints.
    const seed: Record<string, string> = {};
    for (const p of sel.params) {
      const s = sel.sampleBody?.[p.name];
      if (s !== undefined) seed[p.name] = typeof s === 'string' ? s : JSON.stringify(s);
    }
    setValues(seed); setResp(null);
  }, [sel]);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  function buildUrl(): string {
    const qs = sel.params.filter((p) => p.in === 'query' && values[p.name]).map((p) => `${encodeURIComponent(p.name)}=${encodeURIComponent(values[p.name]!)}`).join('&');
    return `${sel.path}${qs ? `?${qs}` : ''}`;
  }
  function buildBody(): Record<string, unknown> | undefined {
    const body: Record<string, unknown> = {};
    for (const p of sel.params.filter((x) => x.in === 'body')) {
      const raw = values[p.name];
      if (raw === undefined || raw === '') continue;
      if (p.type.includes('[]')) { try { body[p.name] = JSON.parse(raw); } catch { body[p.name] = raw.split(',').map((s) => s.trim()); } }
      else if (p.type === 'number') body[p.name] = Number(raw);
      else body[p.name] = raw;
    }
    return Object.keys(body).length ? body : undefined;
  }

  function curl(): string {
    const body = buildBody();
    const parts = [`curl -X ${sel.method} '${origin}${buildUrl()}'`, `  -H 'Authorization: Bearer ${token || '<YOUR_TOKEN>'}'`];
    if (body) { parts.push(`  -H 'Content-Type: application/json'`); parts.push(`  -d '${JSON.stringify(body)}'`); }
    return parts.join(' \\\n');
  }

  async function send() {
    if (!token) { toast.error('Paste an API token first.'); return; }
    setBusy(true); setResp(null);
    try {
      const body = buildBody();
      const res = await fetch(buildUrl(), {
        method: sel.method,
        headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const text = await res.text();
      let pretty = text; try { pretty = JSON.stringify(JSON.parse(text), null, 2); } catch { /* keep raw */ }
      setResp({ status: res.status, body: pretty });
    } catch (e) {
      setResp({ status: 0, body: e instanceof Error ? e.message : 'Request failed' });
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm">
        <KeyRound className="h-4 w-4 text-muted-foreground" />
        <Input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Paste an API token (Admin → API Tokens)" className="max-w-md flex-1" type="password" />
        <a href="/admin/api-tokens" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">Manage tokens <ExternalLink className="h-3 w-3" /></a>
        <a href="/api/v1/openapi" target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-xs text-primary hover:underline"><FileJson className="h-3.5 w-3.5" /> OpenAPI spec</a>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(240px,300px)_1fr]">
        <div className="rounded-lg border">
          {groups.map((g) => (
            <div key={g}>
              <div className="border-b bg-muted/40 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g}</div>
              {endpoints.filter((e) => e.group === g).map((e) => (
                <button key={e.id} onClick={() => setSel(e)} className={`flex w-full items-center gap-2 border-b px-3 py-2 text-left text-sm hover:bg-muted/50 ${sel.id === e.id ? 'bg-muted' : ''}`}>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${METHOD_TONE[e.method]}`}>{e.method}</span>
                  <span className="truncate font-mono text-xs">{e.path.replace('/api/v1', '')}</span>
                </button>
              ))}
            </div>
          ))}
        </div>

        <div className="space-y-3 rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <span className={`rounded px-2 py-0.5 text-xs font-bold ${METHOD_TONE[sel.method]}`}>{sel.method}</span>
            <code className="text-sm">{sel.path}</code>
            {sel.safe ? <Badge variant="secondary">safe</Badge> : <Badge variant="secondary" className="gap-1 text-amber-600"><ShieldAlert className="h-3 w-3" /> writes data</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">{sel.summary}</p>

          {sel.params.length > 0 && (
            <div className="space-y-2">
              {sel.params.map((p) => (
                <div key={p.name} className="grid grid-cols-[120px_1fr] items-center gap-2">
                  <label className="text-xs">
                    <span className="font-medium">{p.name}</span>
                    {p.required && <span className="text-red-500"> *</span>}
                    <span className="ml-1 text-muted-foreground">{p.in}</span>
                  </label>
                  <Input value={values[p.name] ?? ''} onChange={(e) => setValues((v) => ({ ...v, [p.name]: e.target.value }))} placeholder={p.desc} className="h-8 text-sm" />
                </div>
              ))}
            </div>
          )}

          {!sel.safe && <p className="rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">This call writes to your live data. Use a throwaway record, or start with GET /ping to test your token.</p>}

          <div className="flex items-center gap-2">
            <Button onClick={send} disabled={busy} className="gap-1"><Send className="h-4 w-4" /> {busy ? 'Sending…' : 'Send'}</Button>
            <Button variant="outline" onClick={() => { navigator.clipboard.writeText(curl()); toast.success('curl copied'); }} className="gap-1"><Copy className="h-4 w-4" /> Copy curl</Button>
          </div>

          <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs"><code>{curl()}</code></pre>

          {resp && (
            <div>
              <div className="mb-1 flex items-center gap-2 text-xs">
                <span className="font-medium">Response</span>
                <span className={`rounded px-1.5 py-0.5 ${resp.status >= 200 && resp.status < 300 ? 'bg-emerald-500/15 text-emerald-600' : 'bg-red-500/15 text-red-600'}`}>{resp.status || 'ERR'}</span>
              </div>
              <pre className="max-h-80 overflow-auto rounded-md bg-muted p-3 text-xs"><code>{resp.body}</code></pre>
            </div>
          )}
        </div>
      </div>

      {tokens.length === 0 && (
        <p className="text-sm text-muted-foreground">You have no API tokens yet. Create one in <a href="/admin/api-tokens" className="text-primary hover:underline">Admin → API Tokens</a>, then paste it above.</p>
      )}
    </div>
  );
}
