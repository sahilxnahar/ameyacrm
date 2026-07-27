import * as React from 'react';
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

/** Wrapper for a list of rows — bordered, rounded, full width. */
export function RecordList({ children, empty }: { children: React.ReactNode; empty?: string }) {
  const isEmpty = React.Children.count(children) === 0;
  if (isEmpty) return <p className="py-10 text-center text-sm text-muted-foreground">{empty ?? 'Nothing to show.'}</p>;
  return <div className="overflow-hidden rounded-lg border">{children}</div>;
}
