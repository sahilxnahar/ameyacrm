'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Loader2, Copy, Trash2, Send, Power } from 'lucide-react';
import { createWebhook, toggleWebhook, deleteWebhook, testWebhook } from '@/server/actions/webhooks';
import { WEBHOOK_EVENTS } from '@/lib/webhooks/events';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

interface Hook {
  id: string; url: string; events: string[]; isActive: boolean; description: string | null;
  source: string; lastStatus: number | null; lastError: string | null; lastDeliveryAt: string | null; failureCount: number;
}

export function WebhooksView({ hooks }: { hooks: Hook[] }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [url, setUrl] = React.useState('');
  const [desc, setDesc] = React.useState('');
  const [events, setEvents] = React.useState<Set<string>>(new Set(['lead.created']));
  const [freshSecret, setFreshSecret] = React.useState<string | null>(null);

  function toggleEvent(k: string) {
    setEvents((prev) => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || events.size === 0) { toast.error('Add a URL and at least one event.'); return; }
    start(async () => {
      const r = await createWebhook({ url: url.trim(), events: [...events], description: desc.trim() || undefined });
      if ('error' in r) { toast.error(r.error); return; }
      setFreshSecret(r.secret ?? null);
      setUrl(''); setDesc('');
      toast.success('Webhook added — copy the signing secret now');
      router.refresh();
    });
  }

  const act = (label: string, fn: () => Promise<{ ok: true } | { error: string }>) => start(async () => {
    const r = await fn();
    if ('error' in r) { toast.error(r.error); return; }
    toast.success(label); router.refresh();
  });

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="space-y-3 rounded-lg border p-4">
        <div className="font-medium">Add a webhook</div>
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://hooks.zapier.com/…  or your Make/custom URL" />
        <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description (optional) — e.g. “Push new leads to our sheet”" />
        <div className="flex flex-wrap gap-2">
          {WEBHOOK_EVENTS.map((ev) => (
            <button
              key={ev.key}
              type="button"
              onClick={() => toggleEvent(ev.key)}
              className={`rounded-full border px-3 py-1 text-xs ${events.has(ev.key) ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
              title={ev.blurb}
            >
              {ev.label}
            </button>
          ))}
        </div>
        <Button type="submit" disabled={pending} className="gap-1">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add webhook
        </Button>
      </form>

      {freshSecret && (
        <Card className="border-primary/40 bg-primary/5 p-4">
          <div className="mb-1 text-sm font-medium">Signing secret — shown once</div>
          <p className="mb-2 text-xs text-muted-foreground">Store this in your receiver. Each delivery includes <code>x-ameya-signature: sha256=HMAC(secret, rawBody)</code> so you can verify it came from us.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-muted px-2 py-1 text-xs">{freshSecret}</code>
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(freshSecret); toast.success('Copied'); }} className="gap-1">
              <Copy className="h-3.5 w-3.5" /> Copy
            </Button>
          </div>
        </Card>
      )}

      <div className="space-y-3">
        {hooks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No webhooks yet. Add one above to start pushing events.</p>
        ) : (
          hooks.map((h) => (
            <Card key={h.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{h.url}</span>
                    <Badge variant={h.isActive ? 'default' : 'secondary'}>{h.isActive ? 'Active' : 'Off'}</Badge>
                    {h.source !== 'manual' && <Badge variant="secondary">{h.source}</Badge>}
                  </div>
                  {h.description && <div className="text-xs text-muted-foreground">{h.description}</div>}
                  <div className="mt-1 flex flex-wrap gap-1">
                    {h.events.map((e) => <span key={e} className="rounded bg-muted px-1.5 py-0.5 text-[11px]">{e}</span>)}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {h.lastDeliveryAt
                      ? `Last: ${h.lastStatus ?? '—'}${h.lastError ? ` (${h.lastError})` : ''} · ${new Date(h.lastDeliveryAt).toLocaleString()}`
                      : 'No deliveries yet'}
                    {h.failureCount > 0 && ` · ${h.failureCount} failure(s)`}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => act('Test sent', () => testWebhook(h.id))} className="gap-1"><Send className="h-3.5 w-3.5" /> Test</Button>
                  <Button size="sm" variant="outline" onClick={() => act(h.isActive ? 'Disabled' : 'Enabled', () => toggleWebhook(h.id, !h.isActive))} className="gap-1"><Power className="h-3.5 w-3.5" /> {h.isActive ? 'Disable' : 'Enable'}</Button>
                  <Button size="sm" variant="outline" onClick={() => act('Removed', () => deleteWebhook(h.id))} className="gap-1 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
