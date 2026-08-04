import * as React from 'react';
import { Inbox, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/**
 * Shared building blocks for the full-width, colour-coded record lists that
 * replace cramped tables across the app (Leads, Billing, Buyers, …).
 * Client-safe (no server imports).
 */

/** A stable monogram tile derived from a name — the identity anchor on each row. */
export function Monogram({ name, className }: { name: string; className?: string }) {
  const initials =
    name.replace(/[^A-Za-z0-9 ]/g, '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return (
    <div
      className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white', className)}
      style={{ background: `hsl(${h} 45% 45%)` }}
    >
      {initials}
    </div>
  );
}

const GOOD = ['won', 'approved', 'active', 'paid', 'completed', 'complete', 'done', 'closed', 'resolved', 'accepted', 'passed', 'cleared', 'available', 'booked', 'signed', 'verified', 'success'];
const BAD = ['overdue', 'lost', 'rejected', 'cancelled', 'canceled', 'failed', 'blocked', 'breach', 'breached', 'expired', 'defaulted', 'disputed', 'stopped', 'error', 'void'];
const WARN = ['pending', 'pending_approval', 'submitted', 'raised', 'in_progress', 'review', 'awaiting', 'hold', 'on_hold', 'partial', 'due', 'draft', 'open', 'sent', 'processing', 'negotiation', 'site_visit', 'blocked_hold', 'held'];

/** Left-edge accent colour matching the app's status language (green/red/amber/neutral). */
export function statusAccent(status: string | null | undefined): string {
  const s = (status ?? '').toLowerCase();
  if (GOOD.includes(s)) return 'border-l-emerald-500';
  if (BAD.includes(s)) return 'border-l-red-500';
  if (WARN.includes(s)) return 'border-l-amber-500';
  return 'border-l-transparent';
}

/**
 * Wrapper for a list of rows — bordered, rounded, full width.
 *
 * The empty state is a composed panel rather than a line of grey text.
 *
 * An empty screen is the one moment you have someone's whole attention and
 * nothing competing for it, and it is almost always their FIRST moment on that
 * screen — there is nothing there because they have not done anything yet. A
 * centred sentence in muted grey reads as a system that has failed to load.
 * The same space, given a frame, an icon and a sentence about what belongs
 * here, reads as a system waiting for you.
 *
 * `empty` still accepts a plain string, so all 31 existing call sites keep
 * working and simply look better. Pass `emptyTitle`, `emptyIcon` or
 * `emptyAction` where a screen deserves more.
 */
export function RecordList({
  children, empty, emptyTitle, emptyIcon: Icon, emptyAction,
}: {
  children: React.ReactNode;
  empty?: string;
  emptyTitle?: string;
  emptyIcon?: LucideIcon;
  emptyAction?: React.ReactNode;
}) {
  const isEmpty = React.Children.count(children) === 0;
  if (isEmpty) {
    return (
      <div className="flex flex-col items-center rounded-lg border border-dashed bg-muted/20 px-6 py-12 text-center">
        <span
          aria-hidden
          className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-background text-muted-foreground shadow-sm ring-1 ring-border"
        >
          {Icon ? <Icon className="h-5 w-5" /> : <Inbox className="h-5 w-5" />}
        </span>
        <p className="font-display text-base font-semibold">{emptyTitle ?? 'Nothing here yet'}</p>
        {/* ~65 characters is the readable measure; an explanation wider than the
            list it is explaining is harder to read than the list. */}
        <p className="mt-1 max-w-[42ch] text-pretty text-sm text-muted-foreground">
          {empty ?? 'Nothing to show.'}
        </p>
        {emptyAction && <div className="mt-4">{emptyAction}</div>}
      </div>
    );
  }
  return <div className="record-list overflow-hidden rounded-lg border">{children}</div>;
}
