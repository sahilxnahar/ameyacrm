'use client';
import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UploadCloud, MessageSquare, Sparkles, BookOpen, LayoutGrid, Users2, Building2, Wallet, HardHat } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

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

export function SubNav({ allowed, isSuperAdmin }: { allowed: Set<string>; isSuperAdmin: boolean }) {
  const pathname = usePathname() || '';
  const items = ITEMS.filter((i) => !i.perm || isSuperAdmin || allowed.has(i.perm));
  if (!items.length) return null;

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
      </div>
    </nav>
  );
}
