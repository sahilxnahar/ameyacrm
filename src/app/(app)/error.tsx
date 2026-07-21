'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';
import { RepairButton } from '@/components/layout/repair-button';
import { Button } from '@/components/ui/button';

/**
 * The error boundary for the whole signed-in app segment.
 *
 * The top-level `error.tsx` replaces everything; this one sits *inside* the app
 * shell, so when a single page throws you keep your navigation and can recover in
 * place instead of being thrown to a blank screen — the contained version of the
 * "crash reporter that crashed" lesson. It names a database-drift cause and
 * offers the repair, exactly as `PageLoadError` does, because that is the single
 * commonest real cause of a page throwing after a deploy.
 */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Report to the console (and thereby any attached monitoring) so a thrown
    // page is known, not just seen.
    console.error('[app-error]', error);
  }, [error]);

  const raw = error?.message ?? '';
  const drift = /column .* does not exist|Unknown argument|does not exist in the current database|relation ".*" does not exist|P2022|P2021/i.test(raw);
  const missing = raw.match(/column [`"]?([\w.]+)[`"]?/i)?.[1];

  return (
    <div className="mx-auto max-w-xl rounded-lg border border-destructive/40 bg-destructive/5 p-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        <div className="min-w-0 space-y-3">
          <p className="font-medium text-destructive">This screen hit an error.</p>
          {drift ? (
            <>
              <p className="text-sm text-muted-foreground">
                The database is missing {missing ? <code className="rounded bg-muted px-1">{missing}</code> : 'something this version of the app needs'}.
                The code is deployed but the database has not caught up — nothing is broken and no data is lost. Add the
                missing pieces and reload:
              </p>
              <RepairButton />
            </>
          ) : (
            <p className="break-words text-sm text-muted-foreground">
              {raw ? raw.slice(0, 300) : 'Something went wrong loading this screen.'} Your other screens are unaffected.
            </p>
          )}
          <div className="flex gap-2 pt-1">
            <Button onClick={() => reset()} variant="default" size="sm">
              <RotateCw className="h-4 w-4" /> Try again
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href="/dashboard">Go to dashboard</a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
