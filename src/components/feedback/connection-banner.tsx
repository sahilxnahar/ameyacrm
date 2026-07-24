'use client';
import * as React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

/**
 * Tells people when the connection has gone, rather than letting saves fail
 * silently and look like the app is broken.
 */
export function ConnectionBanner() {
  const [offline, setOffline] = React.useState(false);
  const [restored, setRestored] = React.useState(false);

  React.useEffect(() => {
    setOffline(!navigator.onLine);
    const goOffline = () => { setOffline(true); setRestored(false); };
    const goOnline = () => {
      setOffline(false);
      setRestored(true);
      setTimeout(() => setRestored(false), 4000);
    };
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  if (!offline && !restored) return null;

  return (
    <div
      role="status"
      className={`fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-[90] mx-auto w-fit rounded-full px-4 py-2 text-xs font-medium shadow-lg lg:bottom-4 ${
        offline ? 'bg-[#7A1F1F] text-white' : 'bg-[#0F6E56] text-white'
      }`}
    >
      {offline ? (
        <span className="flex items-center gap-2"><WifiOff className="h-3.5 w-3.5" /> No connection — anything you save now will not go through</span>
      ) : (
        <span className="flex items-center gap-2"><RefreshCw className="h-3.5 w-3.5" /> Back online</span>
      )}
    </div>
  );
}
