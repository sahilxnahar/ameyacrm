'use client';
import * as React from 'react';
import { toast } from 'sonner';
import { Search, Check, Plug, Power, Trash2, Star, X, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AUTH_LABEL, type ConnectorDef } from '@/config/connectors';
import { isConfigurable } from '@/config/connector-drivers';
import { installConnector, setConnectorEnabled, uninstallConnector } from '@/server/actions/connectors';
import { ConfigureConnector } from '@/components/exchange/configure-connector';

type Installs = Record<string, { status: string; config: Record<string, unknown> | null }>;

const TIER_TONE: Record<string, string> = {
  live: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  beta: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  available: 'bg-muted text-muted-foreground',
};
const TIER_LABEL: Record<string, string> = { live: 'Live', beta: 'Beta', available: 'Available' };

/**
 * The connectors that genuinely move data end-to-end today. Everything else is a
 * directory placeholder that is NOT built yet — we say so plainly rather than
 * badge it "Live". Messaging (Slack/Discord/Telegram), Razorpay, WhatsApp (via
 * OpenWA), the property portals (inbound leads), and Gmail/Sheets/Drive (via the
 * Apps Script connector) are the real ones.
 */
const WORKING_SLUGS = new Set<string>([
  'slack', 'discord', 'telegram', 'razorpay', 'whatsapp-business',
  'gmail', 'google-sheets', 'google-drive',
  '99acres', 'magicbricks', 'housing-com', 'nobroker', 'square-yards', 'sulekha', 'commonfloor', 'proptiger',
]);
function isWorking(slug: string): boolean { return WORKING_SLUGS.has(slug); }

/** A stable, logo-free monogram tile so we ship no third-party trademarks as images. */
function Monogram({ name }: { name: string }) {
  const initials = name.replace(/[^A-Za-z0-9 ]/g, '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
  let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-white" style={{ background: `hsl(${h} 55% 45%)` }}>
      {initials}
    </div>
  );
}

export function AppExchange({ connectors, categories, installs: initial }: { connectors: ConnectorDef[]; categories: string[]; installs: Installs }) {
  const [installs, setInstalls] = React.useState<Installs>(initial);
  const [q, setQ] = React.useState('');
  const [cat, setCat] = React.useState<string>('All');
  const [tab, setTab] = React.useState<'all' | 'installed'>('all');
  const [detail, setDetail] = React.useState<ConnectorDef | null>(null);
  const [configuring, setConfiguring] = React.useState<ConnectorDef | null>(null);
  const [, start] = React.useTransition();

  const installedCount = Object.keys(installs).length;

  const filtered = connectors.filter((c) => {
    if (tab === 'installed' && !installs[c.slug]) return false;
    if (cat !== 'All' && c.category !== cat) return false;
    if (q && !`${c.name} ${c.category} ${c.blurb}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
  // Popular + live first within the filtered set.
  filtered.sort((a, b) => (Number(!!b.popular) - Number(!!a.popular)) || (a.tier === 'live' ? -1 : 1) - (b.tier === 'live' ? -1 : 1) || a.name.localeCompare(b.name));

  function act(label: string, fn: () => Promise<{ ok: true } | { error: string }>, apply: () => void) {
    start(async () => {
      const r = await fn();
      if ('error' in r) { toast.error(r.error); return; }
      apply(); toast.success(label);
    });
  }

  const install = (c: ConnectorDef) => act(`${c.name} installed`, () => installConnector(c.slug), () => setInstalls((m) => ({ ...m, [c.slug]: { status: 'INSTALLED', config: null } })));
  const toggle = (c: ConnectorDef, on: boolean) => act(on ? `${c.name} enabled` : `${c.name} disabled`, () => setConnectorEnabled(c.slug, on), () => setInstalls((m) => ({ ...m, [c.slug]: { ...(m[c.slug] ?? { config: null }), status: on ? 'INSTALLED' : 'DISABLED' } })));
  const remove = (c: ConnectorDef) => act(`${c.name} removed`, () => uninstallConnector(c.slug), () => setInstalls((m) => { const n = { ...m }; delete n[c.slug]; return n; }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search 140+ connectors…" className="pl-8" />
        </div>
        <div className="flex overflow-hidden rounded-md border text-sm">
          <button onClick={() => setTab('all')} className={`px-3 py-1.5 ${tab === 'all' ? 'bg-primary text-primary-foreground' : ''}`}>All</button>
          <button onClick={() => setTab('installed')} className={`px-3 py-1.5 ${tab === 'installed' ? 'bg-primary text-primary-foreground' : ''}`}>Installed{installedCount ? ` (${installedCount})` : ''}</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {['All', ...categories].map((c) => (
          <button key={c} onClick={() => setCat(c)} className={`rounded-full border px-3 py-1 text-xs ${cat === c ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>{c}</button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((c) => {
          const inst = installs[c.slug];
          return (
            <div key={c.slug} className="flex flex-col rounded-lg border p-3">
              <div className="flex items-start gap-3">
                <Monogram name={c.name} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setDetail(c)} className="truncate font-medium hover:underline">{c.name}</button>
                    {c.popular && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />}
                  </div>
                  <div className="text-xs text-muted-foreground">{c.category}</div>
                </div>
                {isWorking(c.slug)
                  ? <span className="shrink-0 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">Live</span>
                  : <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">Not built yet</span>}
              </div>
              <p className="mt-2 line-clamp-2 flex-1 text-xs text-muted-foreground">{isWorking(c.slug) ? c.blurb : 'Listed in the directory — not built yet. Installing only records interest; ask us to prioritise it.'}</p>
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="text-[11px] text-muted-foreground">{AUTH_LABEL[c.auth]}</span>
                {inst ? (
                  <div className="flex items-center gap-1">
                    <Badge variant={inst.status === 'INSTALLED' ? 'default' : 'secondary'} className="gap-1"><Check className="h-3 w-3" />{inst.status === 'INSTALLED' ? 'Installed' : 'Off'}</Badge>
                    {isConfigurable(c.slug) && <Button size="sm" variant="ghost" onClick={() => setConfiguring(c)} title="Configure"><Settings2 className="h-3.5 w-3.5" /></Button>}
                    <Button size="sm" variant="ghost" onClick={() => toggle(c, inst.status !== 'INSTALLED')} title={inst.status === 'INSTALLED' ? 'Disable' : 'Enable'}><Power className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(c)} title="Remove" className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                ) : (
                  <Button size="sm" onClick={() => install(c)} className="gap-1"><Plug className="h-3.5 w-3.5" /> Install</Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {filtered.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No connectors match. Try a different search or category.</p>}

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto overscroll-contain" onClick={() => setDetail(null)}>
          <div className="my-auto w-full max-w-md rounded-xl border bg-background p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <Monogram name={detail.name} />
              <div className="flex-1">
                <div className="flex items-center gap-2 font-semibold">{detail.name}{isWorking(detail.slug)
                  ? <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[11px] text-emerald-600 dark:text-emerald-400">Live</span>
                  : <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">Not built yet</span>}</div>
                <div className="text-xs text-muted-foreground">{detail.category} · {AUTH_LABEL[detail.auth]}</div>
              </div>
              <button onClick={() => setDetail(null)}><X className="h-4 w-4 text-muted-foreground" /></button>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{isWorking(detail.slug) ? detail.blurb : 'This app appears in the directory but is not built yet.'}</p>
            {!isWorking(detail.slug) && (
              <p className="mt-2 rounded-md bg-muted/60 p-2 text-xs text-muted-foreground">Not built yet. Installing only records your interest — tell us to prioritise it and we&apos;ll build it for real, one at a time.</p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              {installs[detail.slug] && isConfigurable(detail.slug) && (
                <Button variant="outline" onClick={() => { setConfiguring(detail); setDetail(null); }} className="gap-1"><Settings2 className="h-4 w-4" /> Configure</Button>
              )}
              {installs[detail.slug]
                ? <Button variant="outline" onClick={() => { remove(detail); setDetail(null); }} className="gap-1"><Trash2 className="h-4 w-4" /> Remove</Button>
                : <Button onClick={() => { install(detail); setDetail(null); }} className="gap-1"><Plug className="h-4 w-4" /> Install</Button>}
            </div>
          </div>
        </div>
      )}

      {configuring && <ConfigureConnector slug={configuring.slug} name={configuring.name} onClose={() => setConfiguring(null)} />}
    </div>
  );
}
