import { cn } from '@/lib/utils/cn';

/**
 * <BrandWatermark /> — the Ameya Heights emblem, rendered as a background brand
 * mark. One component, two jobs, sourced from the single official asset at
 * `/brand/watermark-mark.png`:
 *
 *  - variant="workspace" (default): a faint, fixed, non-interactive texture behind
 *    every interactive screen. Very low opacity (≈10% light / 16% dark) so it reads
 *    as brand presence, not clutter. This is the global shell watermark.
 *
 *  - variant="document": a crisp, higher-opacity centred mark for official document
 *    and report views (RA Bills, Demand Letters, Certifier sign-offs) that get
 *    printed or exported. It sits inside a `position: relative` document container
 *    (not the fixed viewport) and survives print via `print:` opacity.
 *
 * Zero brand regression: this preserves the exact look the shell shipped with, and
 * centralises the asset so banners/letterheads and this mark never drift apart.
 */
export interface BrandWatermarkProps {
  variant?: 'workspace' | 'document';
  /** Extra classes for the workspace wrapper — used by the shell to mirror the
   *  sidebar rail offset (e.g. `lg:pl-72`) so the mark stays optically centred. */
  padClassName?: string;
  className?: string;
}

const ASSET = '/brand/watermark-mark.png';

export function BrandWatermark({ variant = 'workspace', padClassName, className }: BrandWatermarkProps) {
  if (variant === 'document') {
    // Meant to be dropped inside a `relative` document/report canvas. Crisp,
    // centred, and print-safe. Larger and slightly stronger than the workspace mark.
    return (
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-0 z-0 flex items-center justify-center overflow-hidden',
          className,
        )}
      >
        <img
          src={ASSET}
          alt=""
          decoding="async"
          className="w-[min(70%,540px)] max-w-none select-none opacity-[0.06] [image-rendering:auto] print:opacity-[0.12] dark:opacity-[0.10]"
        />
      </div>
    );
  }

  // variant === 'workspace' — the global, fixed shell watermark.
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none fixed inset-0 z-0 flex items-center justify-center overflow-hidden print:hidden',
        padClassName,
        className,
      )}
    >
      <img
        src={ASSET}
        alt=""
        decoding="async"
        className="w-[min(74vw,640px)] max-w-none select-none opacity-[0.10] dark:opacity-[0.16]"
      />
    </div>
  );
}
