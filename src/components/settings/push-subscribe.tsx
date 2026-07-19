'use client';
import * as React from 'react';
import { toast } from 'sonner';
import { BellRing, BellOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function PushSubscribe() {
  const [state, setState] = React.useState<'unknown' | 'subscribed' | 'unsubscribed' | 'unsupported'>('unknown');
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) { setState('unsupported'); return; }
    navigator.serviceWorker.ready.then(async (reg) => setState((await reg.pushManager.getSubscription()) ? 'subscribed' : 'unsubscribed')).catch(() => setState('unsupported'));
  }, []);

  const subscribe = async () => {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { toast.error('Notification permission denied.'); return; }
      const keyRes = await fetch('/api/push/subscribe');
      const { key } = await keyRes.json();
      if (!key) { toast.error('Push is not configured on the server (VAPID keys missing).'); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) });
      const json = sub.toJSON();
      const res = await fetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }) });
      if (!res.ok) throw new Error();
      setState('subscribed'); toast.success('Push notifications enabled on this device.');
    } catch { toast.error('Could not enable push notifications.'); } finally { setBusy(false); }
  };

  const unsubscribe = async () => {
    setBusy(true);
    try { const reg = await navigator.serviceWorker.ready; const sub = await reg.pushManager.getSubscription(); await sub?.unsubscribe(); setState('unsubscribed'); toast.success('Push disabled on this device.'); }
    catch { toast.error('Could not disable push.'); } finally { setBusy(false); }
  };

  if (state === 'unsupported') return <p className="text-sm text-muted-foreground">Push notifications aren’t supported in this browser.</p>;
  return state === 'subscribed'
    ? <Button variant="outline" size="sm" onClick={unsubscribe} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellOff className="h-4 w-4" />} Disable push on this device</Button>
    : <Button size="sm" onClick={subscribe} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />} Enable push on this device</Button>;
}
