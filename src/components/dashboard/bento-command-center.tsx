'use client';
import * as React from 'react';
import Link from 'next/link';
import { Search, ArrowUpRight, Building2, Users2, HardHat, Wallet, Scale, LayoutGrid, ShieldAlert, CheckCircle2 } from 'lucide-react';
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
  const [showAll, setShowAll] = React.useState(false);

  // Fire the existing global Cmd+K palette (listens on window keydown).
  function openPalette() {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }));
  }

  // Declutter: by default surface only the signals that actually need attention
  // (a non-zero count). The dozen "all clear" tiles are hidden behind a toggle so
  // the grid reads as a short, scannable to-do list rather than a wall of zeros.
  const attention = tiles.filter((t) => t.value > 0);
  const clearCount = tiles.length - attention.length;
  const visible = showAll ? tiles : attention;

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
            <kbd className="ml-2 rounded border bg-muted px-1.5 py-0.5 text-[11px] font-medium">⌘K</kbd>
          </button>
        </div>
      </div>

      {/* All-clear state — nothing needs attention and the person hasn't asked to
          see every signal. A single calm card beats a grid of a dozen green zeros. */}
      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border bg-emerald-500/5 px-6 py-10 text-center ring-1 ring-emerald-500/20">
          <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          <div>
            <div className="text-sm font-semibold">All clear across every engine.</div>
            <div className="mt-0.5 text-xs text-muted-foreground">Nothing needs your attention right now. {tiles.length} signals are being watched.</div>
          </div>
          <button onClick={() => setShowAll(true)} className="mt-1 rounded-lg border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted">
            Show all {tiles.length} signals
          </button>
        </div>
      ) : (
        <>
          {/* Uniform alert grid — every tile is an equal, gap-free target. */}
          <div className="stat-grid stat-grid-sm auto-rows-fr">
            {visible.map((t) => (
              <Link
                key={t.key}
                href={t.href}
                className={cn('group flex min-h-[7rem] flex-col justify-between rounded-xl p-4 ring-1 transition-all hover:shadow-md hover:-translate-y-0.5', TONE_RING[t.tone])}
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

          {/* Toggle the calm, all-clear tiles in and out. */}
          {clearCount > 0 ? (
            <button onClick={() => setShowAll((v) => !v)} className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
              {showAll ? `Hide ${clearCount} all-clear signal${clearCount > 1 ? 's' : ''}` : `Show ${clearCount} all-clear signal${clearCount > 1 ? 's' : ''}`}
            </button>
          ) : null}
        </>
      )}

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Building2 className="h-3.5 w-3.5" /> Ameya Heights Command Center — live across every operational engine. Tiles refresh on load; the async worker keeps the numbers honest.
      </p>
    </div>
  );
}
