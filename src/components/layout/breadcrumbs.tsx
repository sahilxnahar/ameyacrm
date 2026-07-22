'use client';
import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ChevronRight } from 'lucide-react';
import { NAVIGATION } from '@/config/navigation';
import { cn } from '@/lib/utils/cn';

interface Crumb { label: string; href?: string }

/** A record id or opaque slug shouldn't show as itself — call it "Details". */
function pretty(seg: string): string {
  if (/^\d+$/.test(seg)) return 'Details';
  if (/^c[a-z0-9]{20,}$/i.test(seg)) return 'Details'; // cuid
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(seg)) return 'Details'; // uuid
  if (/^[A-Za-z0-9_-]{16,}$/.test(seg) && !seg.includes('-')) return 'Details';
  return seg.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * A Google-Drive-style path bar: shows where you are as a clickable trail, so
 * going back up is one click. It reads the address and maps the first part to
 * the menu to get a friendly name and the section it lives in; deeper parts
 * (like a record id) show as "Details".
 */
export function Breadcrumbs() {
  const pathname = usePathname();

  const crumbs = React.useMemo<Crumb[]>(() => {
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length === 0) return [];

    const first = '/' + segments[0];
    let groupLabel: string | null = null;
    let item: { label: string; href: string } | null = null;
    for (const g of NAVIGATION) {
      for (const it of g.items) {
        if (it.href === first) { groupLabel = g.label; item = { label: it.label, href: it.href }; }
      }
    }

    const trail: Crumb[] = [];
    if (groupLabel) trail.push({ label: groupLabel }); // section context, not a page
    if (item) {
      trail.push({ label: item.label, href: item.href });
    } else {
      trail.push({ label: pretty(segments[0] ?? ''), href: first });
    }
    // Anything deeper than the top-level page (a detail record, a sub-view).
    for (let i = 1; i < segments.length; i++) {
      const href = '/' + segments.slice(0, i + 1).join('/');
      trail.push({ label: pretty(segments[i] ?? ''), href });
    }
    return trail;
  }, [pathname]);

  // Nothing useful to show on the home/landing screens.
  if (crumbs.length === 0 || pathname === '/dashboard' || pathname === '/today') return null;

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 pt-3 sm:px-6 lg:px-8">
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 overflow-x-auto py-0.5 text-sm text-muted-foreground [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <Link href="/dashboard" className="flex shrink-0 items-center gap-1 rounded px-1 py-0.5 hover:bg-secondary hover:text-foreground" title="Home">
        <Home className="h-3.5 w-3.5" />
        <span className="sr-only">Home</span>
      </Link>
      {crumbs.map((c, i) => {
        const last = i === crumbs.length - 1;
        return (
          <span key={`${c.label}-${i}`} className="flex shrink-0 items-center gap-1">
            <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-50" />
            {c.href && !last ? (
              <Link href={c.href} className="truncate rounded px-1 py-0.5 hover:bg-secondary hover:text-foreground">{c.label}</Link>
            ) : (
              <span className={cn('truncate px-1 py-0.5', last && 'font-medium text-foreground')}>{c.label}</span>
            )}
          </span>
        );
      })}
    </nav>
    </div>
  );
}
