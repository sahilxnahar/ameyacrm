'use client';
import * as React from 'react';

/** Last line of defence. Reports the crash, then offers a way out. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  React.useEffect(() => {
    fetch('/api/monitoring/client-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: error.message, stack: error.stack, digest: error.digest, path: window.location.pathname }),
    }).catch(() => undefined);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', display: 'grid', placeItems: 'center', minHeight: '100vh', margin: 0, background: '#F7F3EA', color: '#14120E' }}>
        <div style={{ maxWidth: 420, padding: 24, textAlign: 'center' }}>
          <h1 style={{ fontSize: 22, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ fontSize: 14, color: '#5E584C', marginBottom: 20 }}>
            The problem has been reported automatically. You can try again, or head back to the dashboard.
          </p>
          <button onClick={reset} style={{ height: 40, padding: '0 18px', borderRadius: 8, border: 0, background: '#A07D34', color: '#fff', fontSize: 14, cursor: 'pointer', marginRight: 8 }}>Try again</button>
          <a href="/dashboard" style={{ fontSize: 14, color: '#5E584C' }}>Dashboard</a>
        </div>
      </body>
    </html>
  );
}
