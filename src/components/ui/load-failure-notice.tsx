import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/**
 * "Part of this did not load."
 *
 * ── AMH-007 ────────────────────────────────────────────────────────────────
 *
 * The sibling of `ListNotice`, and the same idea: a property of what is on the
 * screen belongs on the screen.
 *
 * `ListNotice` says "you are not seeing all of this because it is capped".
 * This one says "you are not seeing all of this because something broke" — and
 * that is a different, worse sentence, because the screen it appears on is
 * usually saying *nothing is due*.
 *
 * Renders nothing when everything loaded, so it never becomes furniture.
 *
 * `role="alert"` rather than `status`: a false all-clear on a renewals list is
 * something the reader has to be interrupted about. Silence here is the bug.
 */
export function LoadFailureNotice({
  failures,
  what = 'this list',
  className,
}: {
  /** Labels of the sources that did not answer. */
  failures: string[];
  /** What the reader is looking at: 'this list', 'these counts'. */
  what?: string;
  className?: string;
}) {
  if (failures.length === 0) return null;

  return (
    <p
      role="alert"
      className={cn(
        'mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-foreground',
        className,
      )}
    >
      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" aria-hidden />
      <span>
        <strong className="font-semibold">Part of {what} did not load.</strong>{' '}
        {failures.length === 1 ? failures[0] : `${failures.length} sources`} could not be read, so what
        you see is incomplete — please do not read it as &ldquo;nothing due&rdquo;. Refresh, and tell an
        administrator if it keeps happening.
      </span>
    </p>
  );
}
