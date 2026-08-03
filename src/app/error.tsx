'use client';
import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * The outermost in-app error screen.
 *
 * This one renders when the SIGNED-IN LAYOUT itself throws — a layout's own
 * error boundary cannot catch its own failure, so it bubbles here. That makes
 * this screen the signature of "every page is broken", not "this page is
 * broken", and it is worth saying so: the difference sent us looking at the
 * wrong file for an afternoon.
 *
 * It used to `console.error` and nothing more, so a production failure left no
 * trail anywhere. It now reports itself and shows the digest, which is the
 * string you search the server logs for.
 */
export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[root-error]', error);
    fetch('/api/monitoring/client-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: error.message, stack: error.stack, digest: error.digest,
        path: typeof window !== 'undefined' ? window.location.pathname : '',
      }),
    }).catch(() => undefined);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <AlertTriangle className="h-12 w-12 text-destructive" />
      <h1 className="font-display text-3xl font-semibold">Something went wrong</h1>
      <p className="max-w-md text-muted-foreground">
        This is the whole app, not just this screen — usually the database is missing something this
        version needs.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button asChild variant="outline"><a href="/api/health">What is wrong?</a></Button>
      </div>
      {error.digest && (
        <p className="text-xs text-muted-foreground">
          Reference <code className="rounded bg-muted px-1 py-0.5">{error.digest}</code> — search your server logs for this.
        </p>
      )}
    </div>
  );
}
