'use client';
import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Clock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export interface RecentItem { href: string; label: string; icon: LucideIcon }

const KEY = 'amh:recent-nav';
const CAP = 6;

/** Read the stored recent hrefs, newest first. Safe on the server (returns []). */
function readRecent(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * A "Recent" strip: the handful of screens you were just on, so hopping back is
 * one tap and nobody has to re-find a page in the menu. Records the current page
 * to localStorage on every navigation, and shows the rest. Nothing is stored
 * server-side — this is a per-device convenience, and it renders only after
 * mount so the server and client markup always match.
 */
export function RecentNav({ items, onNavigate }: { items: RecentItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const [mounted, setMounted] = React.useState(false);
  const [recent, setRecent] = React.useState<string[]>([]);
  const byHref = React.useMemo(() => new Map(items.map((i) => [i.href, i])), [items]);

  // Keep the latest items in a ref so the record effect below depends only on
  // the pathname. Depending on `items` (a fresh array every render) would fire
  // the effect on every render and risk a set-state loop.
  const itemsRef = React.useRef(items);
  itemsRef.current = items;

  // Seed from storage on mount, then record the current page. Declared before
  // the record effect so stored history loads first and is not overwritten.
  React.useEffect(() => {
    setMounted(true);
    setRecent(readRecent());
  }, []);

  // Record the current page whenever it changes, but only if it maps to a real
  // menu item (so deep pages like /tasks/123 record as their section). Bails
  // when nothing changes, so it can never trigger an extra render.
  React.useEffect(() => {
    if (!pathname) return;
    const match = itemsRef.current.find((i) => pathname === i.href || pathname.startsWith(i.href + '/'));
    if (!match) return;
    setRecent((prev) => {
      const next = [match.href, ...prev.filter((h) => h !== match.href)].slice(0, CAP + 4);
      if (next.length === prev.length && next.every((h, idx) => h === prev[idx])) return prev;
      try { window.localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, [pathname]);

  if (!mounted) return null;

  const shown = recent
    .map((h) => byHref.get(h))
    .filter((i): i is RecentItem => Boolean(i))
    .filter((i) => !(pathname === i.href || pathname.startsWith(i.href + '/')))
    .slice(0, CAP);

  if (shown.length === 0) return null;

  return (
    <div>
      <p className="mb-2 flex items-center gap-1 px-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#6B6459] dark:text-[#A8A093]">
        <Clock className="h-2.5 w-2.5" /> Recent
      </p>
      <ul className="space-y-0.5">
        {shown.map((i) => {
          const Icon = i.icon;
          return (
            <li key={i.href}>
              <Link
                href={i.href}
                onClick={onNavigate}
                className={cn('flex min-h-[36px] items-center gap-3 rounded-md px-3 py-1.5 text-sm gold-solid transition-colors hover:bg-primary/5')}
              >
                <Icon className="h-4 w-4 shrink-0 text-[#6B6459]" />
                <span className="truncate">{i.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
