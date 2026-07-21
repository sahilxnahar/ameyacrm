import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { checkSchema } from '@/server/services/schema-check-service';

/**
 * A banner that appears when the code is newer than the database. It is the
 * cause of most "the whole app is broken" reports, and it is invisible without
 * being told.
 */
export async function SchemaWarning() {
  const { behind, missing } = await checkSchema();
  if (!behind) return null;

  const shown = missing.slice(0, 4).join(', ');
  return (
    <div className="border-b border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
      <p className="flex flex-wrap items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1">
          <strong>The database is behind the code.</strong> {missing.length} thing
          {missing.length === 1 ? '' : 's'} missing ({shown}{missing.length > 4 ? ', …' : ''}).
          Screens will fail with unhelpful errors until the migration SQL for this version is run in Neon.
          {' '}
          <Link href="/admin/performance" className="underline">See the full list</Link>
        </span>
      </p>
    </div>
  );
}
