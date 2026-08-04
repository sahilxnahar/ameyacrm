import Link from 'next/link';
import { Info } from 'lucide-react';
import type { ListMeta } from '@/lib/list/page-window';
import { cn } from '@/lib/utils/cn';

/**
 * "You are not seeing all of this."
 *
 * Renders nothing when the list is complete, so it never becomes furniture
 * people stop reading. When it does appear it says three things, in this order:
 * how many are on screen, how many exist, and what to do about it.
 *
 * Deliberately not a toast and not a dismissible banner. The fact that a list
 * is partial is a property of what is on the screen, so it belongs on the
 * screen, underneath it, for as long as it is true.
 */
export function ListNotice({
  meta, noun = 'records', className,
}: {
  meta: ListMeta;
  /** Plural noun for this list: 'bills', 'leads', 'suppliers'. */
  noun?: string;
  className?: string;
}) {
  if (!meta.truncated) return null;

  const shown = meta.shown.toLocaleString('en-IN');
  const total = meta.total.toLocaleString('en-IN');

  return (
    <p
      // Announced, because someone who filtered a list and got 200 rows needs
      // to know the count is capped whether or not they can see this line.
      role="status"
      className={cn(
        'mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-md border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground',
        className,
      )}
    >
      <Info className="h-3.5 w-3.5 shrink-0 text-brass" aria-hidden />
      <span>
        Showing <strong className="font-semibold text-foreground tabular-nums">{shown}</strong> of{' '}
        <strong className="font-semibold text-foreground tabular-nums">{total}</strong> {noun}.
      </span>
      {meta.cappedAtMax ? (
        // Already asked for everything and there is still more. Saying "narrow
        // the filters" here would be advice that does not work.
        <span>
          This screen will not show more than {shown} at once — filter it down, or export the full set from Reports.
        </span>
      ) : (
        <>
          <span>Narrow the filters, or</span>
          <Link
            href="?rows=all"
            // scroll={false} keeps the reader where they were rather than
            // throwing them to the top of a now-longer page.
            scroll={false}
            className="focus-ring rounded font-semibold text-brass underline underline-offset-2"
          >
            show all {total}
          </Link>
          <span className="text-muted-foreground/70">(slower to load)</span>
        </>
      )}
    </p>
  );
}
