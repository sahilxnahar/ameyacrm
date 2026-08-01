'use client';
import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UploadCloud, MessageSquare, Sparkles, BookOpen, LayoutGrid, Users2, Building2, Wallet, HardHat, Star, FileBarChart } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { NavCustomiser } from './nav-customiser';
import { EMPTY_TOP_NAV_PREFS, type TopNavPrefs } from '@/lib/nav/top-nav-prefs';
import { DEMO_NAV } from '@/lib/guest/guest-mode';

/**
 * Ameya OS secondary navigation — the row directly beneath the Top-Bar.
 *
 * Why this exists: on a 13" laptop (~1280px) the Top-Bar was carrying a dozen
 * controls in a single row — project switcher, search, upload, four module
 * links, tour, new, alerts, display, theme and the avatar. Their labels only
 * appeared at 1536px, so at 1280px it collapsed into a cramped icon strip that
 * visually collided. Moving the module links down here gives every item room to
 * show a real label, and leaves the Top-Bar for identity + search + actions.
 *
 * Layout rules:
 *  - Sticks directly below the Top-Bar (offset matches `.app-topbar` height).
 *  - Never wraps: on a narrow window it scrolls horizontally, so it can never
 *    push into or overlap the row above or the page content below.
 *  - Hidden on phones (< md), where the Mobile Dock already covers navigation.
 */
interface Item { href: string; label: string; Icon: LucideIcon; perm?: string }

/** Icon for each kind of pinned thing. */
const PIN_ICON: Record<string, LucideIcon> = {
  ledger: BookOpen, project: Building2, screen: LayoutGrid, report: FileBarChart,
};

const ITEMS: Item[] = [
  { href: '/sales', label: 'Sales', Icon: Users2, perm: 'lead.view' },
  { href: '/inventory', label: 'Inventory', Icon: Building2, perm: 'unit.view' },
  { href: '/finance', label: 'Finance', Icon: Wallet, perm: 'invoice.view' },
  { href: '/site-ops', label: 'Site Ops', Icon: HardHat, perm: 'document.create' },
  { href: '/tally', label: 'Ameya Tally', Icon: BookOpen },
  { href: '/chat', label: 'Messages', Icon: MessageSquare },
  { href: '/assistant', label: 'Assistant', Icon: Sparkles },
  { href: '/documents', label: 'Upload', Icon: UploadCloud, perm: 'document.create' },
  { href: '/features', label: 'Explore', Icon: LayoutGrid },
];

export function SubNav({
  allowed, isSuperAdmin, prefs = EMPTY_TOP_NAV_PREFS, isGuest = false,
}: { allowed: Set<string>; isSuperAdmin: boolean; prefs?: TopNavPrefs; isGuest?: boolean }) {
  const pathname = usePathname() || '';

  // Demo mode: the same row, in the same place, pointing at the demo's own
  // screens. Built from DEMO_NAV rather than filtered from the real list, so a
  // module added to the real CRM cannot accidentally appear here linking at a
  // real route.
  if (isGuest) {
    const ICONS = { home: LayoutGrid, leads: Users2, units: Building2, tasks: HardHat, books: BookOpen } as const;
    return (
      <nav aria-label="Demo modules" className="app-subnav sticky z-subnav hidden border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70 md:block print:!hidden">
        <div className="flex items-center gap-1 overflow-x-auto px-4 py-1.5 sm:px-6 lg:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {DEMO_NAV.map(({ href, label, icon }) => {
            const Icon = ICONS[icon];
            const active = pathname === href || (href !== '/demo' && pathname.startsWith(href + '/'));
            return (
              <Link
                key={href}
                href={href}
                data-tour={`nav-${href}`}
                className={cn(
                  'focus-ring inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors',
                  active ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="whitespace-nowrap">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    );
  }

  // Permission first, then the person's own choice to hide it. Hiding is purely
  // cosmetic — it can never reveal something they lack permission for.
  const permitted = ITEMS.filter((i) => !i.perm || isSuperAdmin || allowed.has(i.perm));
  const items = permitted.filter((i) => !prefs.hidden.includes(i.href));
  const pins = prefs.pins;

  return (
    <nav
      aria-label="Modules"
      className="app-subnav sticky z-subnav hidden border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70 md:block print:!hidden"
    >
      <div className="flex items-center gap-1 overflow-x-auto px-4 py-1.5 sm:px-6 lg:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              data-tour={`nav-${href}`}
              className={cn(
                'focus-ring inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors',
                active
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="whitespace-nowrap">{label}</span>
            </Link>
          );
        })}

        {/* The person's own pins — a ledger, a project, any screen they live in. */}
        {pins.length > 0 && <span aria-hidden className="mx-1 h-4 w-px shrink-0 bg-border" />}
        {pins.map((p) => {
          const PinIcon = PIN_ICON[p.kind] ?? Star;
          const active = pathname === p.href.split('?')[0];
          return (
            <Link
              key={p.href}
              href={p.href}
              title={p.label}
              data-tour={`pin-${p.href}`}
              className={cn(
                'focus-ring inline-flex h-8 max-w-[12rem] shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors',
                active ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
              )}
            >
              <PinIcon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{p.label}</span>
            </Link>
          );
        })}

        <span aria-hidden className="mx-1 h-4 w-px shrink-0 bg-border" />
        <NavCustomiser prefs={prefs} defaults={permitted.map((i) => ({ href: i.href, label: i.label }))} />
      </div>
    </nav>
  );
}
