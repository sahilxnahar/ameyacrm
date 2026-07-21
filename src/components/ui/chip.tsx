import type { ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils/cn';

/**
 * The filter-chip row that every list screen re-implemented — the project
 * switcher at the top of ledger, budgets, land, treasury, programme, quality and
 * capital. One definition now, so they all behave and look the same.
 */
export function ChipRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex gap-2 overflow-x-auto pb-1', className)}>{children}</div>;
}

const chipCls = (active: boolean) =>
  cn(
    'focus-ring shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
    active ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-secondary',
  );

/** A chip that links (the common case: filtering by a query param). */
export function ChipLink({ href, active, children }: { href: string; active: boolean; children: ReactNode }) {
  return (
    <Link href={href} className={chipCls(active)}>
      {children}
    </Link>
  );
}

/** A chip that toggles client-side (tabs, segmented controls). */
export function ChipButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={chipCls(active)}>
      {children}
    </button>
  );
}
