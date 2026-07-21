'use client';

import { useState, useTransition } from 'react';
import { CheckCircle2, AlertTriangle, ExternalLink, Loader2, Plug, ChevronDown, KeyRound } from 'lucide-react';
import { disconnectProvider } from '@/server/actions/connections';

export interface ProviderRow {
  key: string; name: string; what: string; group: string;
  prerequisites: string[]; cost: string; docs: string;
  clientIdEnv: string; clientSecretEnv: string; hasCredentials: boolean;
  status: string; accountName: string | null; connectedAt: string | null; lastError: string | null;
}

const STATUS: Record<string, { label: string; cls: string }> = {
  CONNECTED: { label: 'Connected', cls: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400' },
  DISCONNECTED: { label: 'Not connected', cls: 'bg-muted text-muted-foreground' },
  EXPIRED: { label: 'Login expired', cls: 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-500' },
  ERROR: { label: 'Error', cls: 'bg-destructive/10 text-destructive' },
  NEEDS_SETUP: { label: 'Needs app credentials', cls: 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-500' },
};

export function ConnectionsView({ providers, flashOk, flashError }: { providers: ProviderRow[]; flashOk: string | null; flashError: string | null }) {
  const [open, setOpen] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(
    flashOk ? { kind: 'ok', text: flashOk } : flashError ? { kind: 'err', text: flashError } : null,
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [, start] = useTransition();

  const groups = [...new Set(providers.map((p) => p.group))];

  const disconnect = (p: ProviderRow) =>
    start(async () => {
      setBusy(p.key);
      const res = await disconnectProvider(p.key);
      setBusy(null);
      setMsg('error' in res ? { kind: 'err', text: res.error } : { kind: 'ok', text: res.message });
    });

  return (
    <div className="space-y-5">
      {msg && (
        <p className={`rounded-md p-3 text-sm ${msg.kind === 'ok' ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-destructive/10 text-destructive'}`}>
          {msg.text}
        </p>
      )}

      <div className="card-elevated flex items-start gap-3 p-4 text-sm text-muted-foreground">
        <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <p>
          None of these vendors allow a pure &ldquo;just log in&rdquo; connection. Each needs an app registered once, and two values
          added to Vercel. After that, connecting and reconnecting really is one click — for you and for anyone who replaces you.
          Tokens are encrypted before they touch the database.
        </p>
      </div>

      {groups.map((g) => (
        <section key={g} className="space-y-2">
          <h2 className="font-display text-lg">{g}</h2>
          {providers.filter((p) => p.group === g).map((p) => {
            const st = STATUS[p.status] ?? { label: 'Not connected', cls: 'bg-muted text-muted-foreground' };
            const isOpen = open === p.key;
            return (
              <div key={p.key} className="card-elevated overflow-hidden">
                <div className="flex flex-wrap items-start gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{p.name}</p>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{p.what}</p>
                    {p.accountName && <p className="mt-1 text-xs text-muted-foreground">Account: {p.accountName}</p>}
                    {p.lastError && <p className="mt-1 text-xs text-destructive">{p.lastError}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {p.status === 'CONNECTED' ? (
                      <button
                        type="button" onClick={() => disconnect(p)} disabled={busy === p.key}
                        className="focus-ring rounded-md border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
                      >
                        {busy === p.key ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Disconnect'}
                      </button>
                    ) : p.hasCredentials ? (
                      <a
                        href={`/api/integrations/${p.key}/connect`}
                        className="focus-ring inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
                      >
                        <Plug className="h-4 w-4" />Connect
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">Add credentials first</span>
                    )}
                    <button
                      type="button" onClick={() => setOpen(isOpen ? null : p.key)}
                      className="focus-ring rounded-md border p-1.5 hover:bg-muted" aria-label="What this needs"
                    >
                      <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="space-y-3 border-t bg-muted/30 p-4 text-sm">
                    <div>
                      <p className="font-medium">Before this will work</p>
                      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
                        {p.prerequisites.map((r) => <li key={r}>{r}</li>)}
                      </ul>
                    </div>
                    <div>
                      <p className="font-medium">Set these in Vercel</p>
                      <p className="mt-1 font-mono text-xs text-muted-foreground">{p.clientIdEnv}<br />{p.clientSecretEnv}</p>
                      {p.hasCredentials
                        ? <p className="mt-1 flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" />Both are set.</p>
                        : <p className="mt-1 flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-500"><AlertTriangle className="h-3.5 w-3.5" />Not set yet — the Connect button stays hidden until they are.</p>}
                    </div>
                    <div>
                      <p className="font-medium">Cost</p>
                      <p className="mt-1 text-muted-foreground">{p.cost}</p>
                    </div>
                    <a href={p.docs} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                      Vendor documentation <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}
