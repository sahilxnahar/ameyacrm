import { AlertTriangle } from 'lucide-react';
import { RepairButton } from './repair-button';

/**
 * What a page shows when its data will not load.
 *
 * Next.js hides server error messages in production, so the default boundary
 * says only "something went wrong" — which sent us chasing the wrong bug for a
 * day when the real cause was a database column that had never been added.
 * This names the cause and offers the fix in the same place.
 */
export function PageLoadError({ error }: { error: unknown }) {
  const raw = error instanceof Error ? error.message : String(error);
  const drift =
    /column .* does not exist|Unknown argument|does not exist in the current database|relation ".*" does not exist|P2022|P2021/i.test(raw);
  const missing = raw.match(/column [`"]?([\w.]+)[`"]?/i)?.[1];

  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-5">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        <div className="min-w-0 space-y-2">
          <p className="font-medium text-destructive">This page could not load its data.</p>
          {drift ? (
            <>
              <p className="text-sm text-muted-foreground">
                The database is missing {missing ? <code className="rounded bg-muted px-1">{missing}</code> : 'something this version of the app needs'}.
                The new code is deployed but the database has not caught up. Nothing is broken and no data is lost — the
                database just needs the missing pieces added.
              </p>
              <RepairButton />
            </>
          ) : (
            <p className="break-words text-sm text-muted-foreground">
              {raw.slice(0, 300)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
