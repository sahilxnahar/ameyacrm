'use client';
import * as React from 'react';
import Link from 'next/link';
import { HelpCircle } from 'lucide-react';
import { glossaryById } from '@/config/glossary';
import { cn } from '@/lib/utils/cn';

/**
 * A small "?" next to anything a newcomer might not understand. Click (or focus)
 * to reveal a one-line plain explanation, with a link to the glossary for more.
 * Click-to-reveal on purpose: it works on a phone, where hover does not exist.
 */
export function HelpTip({
  text, termId, label, className,
}: {
  /** The explanation to show. If omitted, the glossary term's plain line is used. */
  text?: string;
  /** A glossary term id — supplies the text (if `text` is absent) and a "more" link. */
  termId?: string;
  /** Accessible label for the button. */
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLSpanElement>(null);
  const term = termId ? glossaryById(termId) : undefined;
  const body = text ?? term?.plain ?? '';

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  if (!body) return null;

  return (
    <span ref={ref} className={cn('relative inline-flex align-middle', className)}>
      <button
        type="button"
        aria-label={label ?? 'What does this mean?'}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-1/2 top-6 z-50 w-60 -translate-x-1/2 rounded-md border bg-popover p-3 text-left text-xs font-normal leading-relaxed text-popover-foreground shadow-lg"
        >
          {term && <span className="mb-1 block font-semibold">{term.term}</span>}
          <span className="block text-muted-foreground">{body}</span>
          {term && (
            <Link href={`/glossary#${term.id}`} className="mt-1.5 inline-block font-medium text-primary hover:underline" onClick={() => setOpen(false)}>
              More in the glossary →
            </Link>
          )}
        </span>
      )}
    </span>
  );
}
