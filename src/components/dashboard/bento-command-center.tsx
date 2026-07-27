'use client';
import * as React from 'react';
import Link from 'next/link';
import { Search, ArrowUpRight, Building2, Users2, HardHat, Wallet, Scale, LayoutGrid, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { AlertTile } from '@/server/services/command-center-service';

// The workspace domains (new top-nav). Each chip lands on a representative screen
// of that domain; the command palette (Cmd+K) remains the primary jump tool.
const WORKSPACES = [
  { key: 'overview', label: 'Overview', href: '/command-center', icon: LayoutGrid },
  { key: 'sales', label: 'Sales & CRM', href: '/sales', icon: Users2 },
  { key: 'site', label: 'Site & Engineering', href: '/structural-contracts', icon: HardHat },
  { key: 'finance', label: 'Finance & Tax', href: '/finance', icon: Wallet },
  { key: 'legal', label: 'Legal', href: '/ip-registry', icon: Scale },
];

const TONE_RING: Record<AlertTile['tone'], string> = {
  destructive: 'ring-destructive/30 bg-destructive/5',
  warning: 'ring-amber-500/30 bg-amber-500/5',
  success: 'ring-emerald-500/20 bg-emerald-500/5',
  default: 'ring-border bg-card',
};
const TONE_NUM: Record<AlertTile['tone'], string> = {
  destructive: 'text-destructive',
  warning: 'text-amber-600 dark:text-amber-400',
  success: 'text-emerald-600 dark:text-emerald-400',
  default: 'text-foreground',
};

export function BentoCommandCenter({ tiles, urgent, firstName }: { tiles: AlertTile[]; urgent: number; firstName: string }) {
  // Fire the existing global Cmd+K palette (listens on window keydown).
  function openPalette() {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }));
  }

  // Bento sizing: the first two tiles span wider for visual rhythm.
  const span = (i: number) => (i === 0 ? 'sm:col-span-2' : i === 3 ? 'sm:row-span-2' : '');

  return (
    <div className="space-y-6">
      {/* Workspace top-nav */}
      <div className="flex flex-wrap items-center gap-2">
        {WORKSPACES.map((w) => (
          <Link key={w.key} href={w.href} className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted', w.key === 'overview' && 'bg-foreground text-background hover:bg-foreground/90')}>
            <w.icon className="h-3.5 w-3.5" /> {w.label}
          </Link>
        ))}
      </div>

      {/* Greeting + command bar */}
      <div className="rounded-xl border bg-gradient-to-br from-muted/60 to-background p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold">Good to see you, {firstName}.</h1>
            <p className="text-sm text-muted-foreground">
              {urgent > 0
                ? <span className="inline-flex items-center gap-1 text-destructive"><ShieldAlert className="h-4 w-4" /> {urgent} item{urgent > 1 ? 's' : ''} need urgent attention.</span>
                : 'Everything critical is clear. Nice.'}
            </p>
          </div>
          <button onClick={openPalette} className="inline-flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm text-muted-foreground shadow-sm transition-colors hover:bg-muted">
            <Search className="h-4 w-4" /> Search or jump to…
            <kbd className="ml-2 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium">⌘K</kbd>
          </button>
        </div>
      </div>

      {/* Bento alert grid */}
      <div className="grid auto-rows-[minmax(7rem,auto)] grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((t, i) => (
          <Link
            key={t.key}
            href={t.href}
            className={cn('group flex flex-col justify-between rounded-xl p-4 ring-1 transition-all hover:shadow-md hover:-translate-y-0.5', TONE_RING[t.tone], span(i))}
          >
            <div className="flex items-start justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t.label}</span>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <div>
              <div className={cn('text-3xl font-bold tabular-nums', TONE_NUM[t.tone])}>{t.value}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{t.hint}</div>
            </div>
          </Link>
        ))}
      </div>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Building2 className="h-3.5 w-3.5" /> Ameya Heights Command Center — live across every operational engine. Tiles refresh on load; the async worker keeps the numbers honest.
      </p>
    </div>
  );
}
