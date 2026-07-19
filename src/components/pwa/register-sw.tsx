'use client';
import * as React from 'react';
import { toast } from 'sonner';

/** Registers the service worker and surfaces the PWA install prompt. */
export function RegisterSW() {
  React.useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    const onLoad = () => navigator.serviceWorker.register('/sw.js').catch(() => {});
    window.addEventListener('load', onLoad);

    const onInstall = (e: Event) => {
      e.preventDefault();
      const deferred = e as Event & { prompt: () => void };
      toast('Install Ameya Heights CRM', {
        description: 'Add the app to your home screen for a native experience.',
        action: { label: 'Install', onClick: () => deferred.prompt() },
        duration: 12000,
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
