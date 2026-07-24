'use client';
import * as React from 'react';
import { toast } from 'sonner';

/** Registers the service worker and surfaces the PWA install prompt. */
export function RegisterSW() {
  React.useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    const onLoad = () => navigator.serviceWorker.register('/sw.js').catch(() => {});
    window.addEventListener('load', onLoad);

    let shown = false;
    const onInstall = (e: Event) => {
      e.preventDefault();
      // Never nag: if they said "Not now" once, don't show again; and show at
      // most once per session even before that.
      try { if (localStorage.getItem('amh:pwa-dismissed')) return; } catch { /* ignore */ }
      if (shown) return;
      shown = true;
      const deferred = e as Event & { prompt: () => void };
      toast('Install Ameya Heights CRM', {
        description: 'Add the app to your home screen for a native experience.',
        action: { label: 'Install', onClick: () => deferred.prompt() },
        cancel: { label: 'Not now', onClick: () => { try { localStorage.setItem('amh:pwa-dismissed', '1'); } catch { /* ignore */ } } },
        duration: 10000,
      });
    };
    window.addEventListener('beforeinstallprompt', onInstall);
    return () => {
      window.removeEventListener('load', onLoad);
      window.removeEventListener('beforeinstallprompt', onInstall);
    };
  }, []);
  return null;
}
