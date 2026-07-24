'use client';
import * as React from 'react';
import Link from 'next/link';
import { Clock, Users2, CheckSquare, FileText, Building2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface RecentRecord { type: string; label: string; href: string }

const KEY = 'amh:recent-records';
const CAP = 10;

const ICON: Record<string, LucideIcon> = { Lead: Users2, Task: CheckSquare, Document: FileText, Booking: Building2 };

function read(): RecentRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? (arr as RecentRecord[]).filter((r) => r && typeof r.href === 'string' && typeof r.label === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Mounted on a record's detail page, this quietly remembers that you opened it,
 * so "Recently viewed" can offer it back later. It renders nothing.
 */
export function TrackRecentRecord({ type, label, href }: RecentRecord) {
  React.useEffect(() => {
    if (!label || !href) return;
    try {
      const prev = read().filter((r) => r.href !== href);
      const next = [{ type, label, href }, ...prev].slice(0, CAP);
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch { /* ignore */ }
  }, [type, label, href]);
  return null;
}

/**
 * "Recently viewed": the last records you opened, so getting back to what you
 * were doing is one tap. Per-device, renders only after mount, and shows nothing
 * until you have opened something.
 */
export function RecentRecords({ max = 6 }: { max?: number }) {
  const [mounted, setMounted] = React.useState(false);
  const [items, setItems] = React.useState<RecentRecord[]>([]);
  React.useEffect(() => { setMounted(true); setItems(read()); }, []);
  if (!mounted || items.length === 0) return null;

  return (
    <div className="mb-5">
      <p className="mb-2 flex items-center gap-1 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Clock className="h-3 w-3" /> Recently viewed
      </p>
      <div className="flex flex-wrap gap-2">
        {items.slice(0, max).map((r) => {
          const Icon = ICON[r.type] ?? Clock;
          return (
            <Link
              key={r.href}
              href={r.href}
              className="inline-flex max-w-[15rem] items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs transition-colors hover:border-primary hover:bg-primary/5"
            >
              <Icon className="h-3.5 w-3.5 shrink-0 text-[#A07D34]" />
              <span className="truncate">{r.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
