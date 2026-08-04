'use client';
import * as React from 'react';
import { useFocusTrap } from '@/lib/a11y/use-focus-trap';
import { toast } from 'sonner';
import { X, Zap, Save, Loader2, Copy, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { driverMeta } from '@/config/connector-drivers';
import { WEBHOOK_EVENTS } from '@/lib/webhooks/events';
import { getConnectorConfig, saveConnectorConfig, testConnector, generateInboundSecret } from '@/server/actions/connectors';

export function ConfigureConnector({ slug, name, onClose }: { slug: string; name: string; onClose: () => void }) {
  const meta = driverMeta(slug);
  const [config, setConfig] = React.useState<Record<string, string>>({});
  const [events, setEvents] = React.useState<Set<string>>(new Set());
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState<'test' | 'save' | null>(null);

  React.useEffect(() => {
    getConnectorConfig(slug).then((r) => {
      if ('config' in r) {
        setConfig(Object.fromEntries(Object.entries(r.config).map(([k, v]) => [k, String(v ?? '')])));
        setEvents(new Set(r.events));
      }
      setLoading(false);
    })
      .catch(() => {
        // A rejected server action never reaches .then, so the flag the
        // success path clears was never cleared: the button stayed disabled
        // with a spinner until someone reloaded the page.
        setLoading(false);
        toast.error('Could not reach the server. Nothing was saved — check your connection and try again.');
      });
  }, [slug]);

  // Hooks must run in the same order on every render, so this sits above the
  // early returns below — not next to the element it attaches to.
  const panelA = useFocusTrap<HTMLDivElement>(true, onClose);

  if (!meta) return null;
  const eventLabel = (k: string) => WEBHOOK_EVENTS.find((e) => e.key === k)?.label ?? k;
  const payload = () => ({ ...config, _events: [...events] });

  if (meta.kind === 'leads') {
    return <InboundConfig slug={slug} name={name} blurb={meta.blurb} onClose={onClose} />;
  }

  function test() {
    setBusy('test');
    testConnector(slug, payload()).then((r) => {
      setBusy(null);
      if ('error' in r) toast.error(r.error); else toast.success(r.message || 'Test message sent');
    })
      .catch(() => {
        // A rejected server action never reaches .then, so the flag the
        // success path clears was never cleared: the button stayed disabled
        // with a spinner until someone reloaded the page.
        setBusy(null);
        toast.error('Could not reach the server. Nothing was saved — check your connection and try again.');
      });
  }
  function save() {
    setBusy('save');
    saveConnectorConfig(slug, payload()).then((r) => {
      setBusy(null);
      if ('error' in r) { toast.error(r.error); return; }
      toast.success(`${name} configured`); onClose();
    })
      .catch(() => {
        // A rejected server action never reaches .then, so the flag the
        // success path clears was never cleared: the button stayed disabled
        // with a spinner until someone reloaded the page.
        setBusy(null);
        toast.error('Could not reach the server. Nothing was saved — check your connection and try again.');
      });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto overscroll-contain" onClick={onClose}>
      <div ref={panelA} role="dialog" aria-modal="true" className="my-auto w-full max-w-md rounded-xl border bg-background p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center justify-between">
          <div className="font-semibold">Configure {name}</div>
          <button onClick={onClose} aria-label="Close"><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>
        <p className="mb-3 text-sm text-muted-foreground">{meta.blurb}</p>

        {loading ? (
          <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>
        ) : (
          <div className="space-y-3">
            {meta.fields.map((f) => (
              <label key={f.key} className="block text-sm">
                <span className="mb-1 block font-medium">{f.label}</span>
                <Input
                  type={f.type === 'password' ? 'password' : 'text'}
                  value={config[f.key] ?? ''}
                  placeholder={f.placeholder}
                  onChange={(e) => setConfig((c) => ({ ...c, [f.key]: e.target.value }))}
                />
                {f.help && <span className="mt-1 block text-xs text-muted-foreground">{f.help}</span>}
              </label>
            ))}

            {meta.kind === 'oauth' && (
              <div>
                <div className="mb-1 text-sm font-medium">Callback URL (register this in your {name} app)</div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate rounded bg-muted px-2 py-1.5 text-xs">{(typeof window !== 'undefined' ? window.location.origin : '')}/api/connectors/oauth/{slug}/callback</code>
                  <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/api/connectors/oauth/${slug}/callback`); toast.success('Copied'); }} className="gap-1" aria-label="Copy the callback URL"><Copy className="h-3.5 w-3.5" /></Button>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Save your client id/secret first, then click Connect to authorise.</p>
              </div>
            )}

            {meta.kind === 'payments' && (
              <div>
                <div className="mb-1 text-sm font-medium">Webhook URL (paste into Razorpay → Settings → Webhooks)</div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate rounded bg-muted px-2 py-1.5 text-xs">{(typeof window !== 'undefined' ? window.location.origin : '')}/api/connectors/razorpay/webhook</code>
                  <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/api/connectors/razorpay/webhook`); toast.success('Copied'); }} className="gap-1" aria-label="Copy the webhook URL"><Copy className="h-3.5 w-3.5" /></Button>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Subscribe it to the <code>payment.captured</code> event. Put a <code>milestoneId</code> or <code>bookingId</code> in the payment notes for automatic reconciliation.</p>
              </div>
            )}

            {meta.events.length > 0 && (
              <div>
                <div className="mb-1 text-sm font-medium">Announce these events</div>
                <div className="flex flex-wrap gap-1.5">
                  {meta.events.map((ev) => (
                    <button
                      key={ev} type="button"
                      onClick={() => setEvents((s) => { const n = new Set(s); n.has(ev) ? n.delete(ev) : n.add(ev); return n; })}
                      className={`rounded-full border px-3 py-1 text-xs ${events.has(ev) ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                    >
                      {eventLabel(ev)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              {meta.kind === 'oauth' ? (
                <>
                  <Button variant="outline" onClick={save} disabled={busy !== null} className="gap-1">
                    {busy === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
                  </Button>
                  <Button onClick={() => { window.location.href = `/api/connectors/oauth/${slug}/start`; }} className="gap-1">
                    <Zap className="h-4 w-4" /> Connect
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={test} disabled={busy !== null} className="gap-1">
                    {busy === 'test' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />} Test
                  </Button>
                  <Button onClick={save} disabled={busy !== null} className="gap-1">
                    {busy === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Configure screen for inbound lead portals: show the URL + a one-time secret. */
function InboundConfig({ slug, name, blurb, onClose }: { slug: string; name: string; blurb: string; onClose: () => void }) {
  const [secret, setSecret] = React.useState<string | null>(null);
  const [path, setPath] = React.useState<string>(`/api/connectors/leads/${slug}`);
  const [busy, setBusy] = React.useState(false);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const fullUrl = secret ? `${origin}${path}?key=${secret}` : `${origin}${path}`;

  function gen() {
    setBusy(true);
    generateInboundSecret(slug).then((r) => {
      setBusy(false);
      if ('error' in r) { toast.error(r.error); return; }
      setSecret(r.secret); setPath(r.path); toast.success('Secret generated — copy it now');
    })
      .catch(() => {
        // A rejected server action never reaches .then, so the flag the
        // success path clears was never cleared: the button stayed disabled
        // with a spinner until someone reloaded the page.
        setBusy(false);
        toast.error('Could not reach the server. Nothing was saved — check your connection and try again.');
      });
  }
  const copy = (t: string) => { navigator.clipboard.writeText(t); toast.success('Copied'); };
  const panelB = useFocusTrap<HTMLDivElement>(true, onClose);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto overscroll-contain" onClick={onClose}>
      <div ref={panelB} role="dialog" aria-modal="true" className="my-auto w-full max-w-lg rounded-xl border bg-background p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center justify-between">
          <div className="font-semibold">Receive {name} leads</div>
          <button onClick={onClose} aria-label="Close"><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>
        <p className="mb-3 text-sm text-muted-foreground">{blurb}</p>
        <ol className="mb-3 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Generate the secret below.</li>
          <li>In your {name} account, set the lead-push / webhook URL to the address shown.</li>
          <li>New leads will arrive in the CRM automatically, deduped and routed by your automations.</li>
        </ol>

        {!secret ? (
          <Button onClick={gen} disabled={busy} className="gap-1">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Generate inbound URL &amp; secret</Button>
        ) : (
          <div className="space-y-3">
            <div>
              <div className="mb-1 text-xs font-medium">Webhook URL (paste into {name})</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded bg-muted px-2 py-1.5 text-xs">{fullUrl}</code>
                <Button size="sm" variant="outline" onClick={() => copy(fullUrl)} className="gap-1" aria-label="Copy this URL"><Copy className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
            <p className="rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">Copy this now — the secret is shown only once. Generating again replaces it.</p>
            <div className="flex justify-between">
              <Button size="sm" variant="ghost" onClick={gen} disabled={busy} className="gap-1"><RefreshCw className="h-3.5 w-3.5" /> Regenerate</Button>
              <Button size="sm" onClick={onClose}>Done</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
