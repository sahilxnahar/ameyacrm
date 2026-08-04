import Link from 'next/link';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/**
 * A column heading that sorts, as a link rather than a click handler.
 *
 * A link means the sorted view has a URL: it can be bookmarked, shared with
 * whoever asked the question, and reached with the back button. It also means
 * the sort happens in the database (see lib/list/sort.ts), which is the part
 * that makes it correct rather than merely present — a client-side sort would
 * reorder the fetched window and present the top of 200 as the top of 2,000.
 *
 * `aria-sort` is what tells a screen reader the table is ordered and which way.
 * Without it the arrow is decoration that only sighted users can read.
 */
export function SortableHeader({
  href, label, active, direction, align = 'left', className,
}: {
  href: string;
  label: string;
  /** True when this is the column currently sorted by. */
  active: boolean;
  direction: 'asc' | 'desc';
  align?: 'left' | 'right';
  className?: string;
}) {
  const Icon = active ? (direction === 'asc' ? ArrowUp : ArrowDown) : ChevronsUpDown;
  return (
    <th
      scope="col"
      aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={cn(
        'h-10 whitespace-nowrap px-3 align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground',
        align === 'right' ? 'text-right' : 'text-left',
        className,
      )}
    >
      <Link
        href={href}
        scroll={false}
        className={cn(
          'focus-ring inline-flex items-center gap-1 rounded hover:text-foreground',
          align === 'right' && 'flex-row-reverse',
          active && 'text-foreground',
        )}
      >
        {label}
        {/*
          The icon is aria-hidden because aria-sort on the <th> already carries
          the state. Announcing both gives "ascending, up arrow" twice over.
        */}
        <Icon className={cn('h-3 w-3 shrink-0', !active && 'opacity-40')} aria-hidden />
      </Link>
    </th>
  );
}
