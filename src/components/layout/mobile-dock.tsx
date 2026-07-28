'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, Search, Plus, Bell } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/**
 * The Ameya OS mobile Dock — a fixed bottom bar shown only below `md`
 * (`md:hidden`), so the desktop Top-Bar never collides with it. Four thumb
 * targets, each ≥44px in both dimensions (Apple/Google touch-target minimum) for
 * one-handed use on a construction site:
 *
 *   [Launchpad]  → the app grid / command center
 *   [Search]     → ⌘K spotlight (opens the command palette)
 *   [Quick Upload +] → the universal document dropzone
 *   [Alerts]     → the Bento alert board
 *
 * The safe-area inset is applied here so the dock clears the iOS home indicator;
 * the shell's <main> reserves matching bottom padding
 * (`pb-[calc(6.5rem+env(safe-area-inset-bottom))]`) so content never hides behind it.
 */
export function MobileDock({ onSearch }: { onSearch: () => void }) {
  const pathname = usePathname();
  const isLaunchpad = pathname === '/command-center';

  return (
    <nav
      aria-label="Ameya OS dock"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur md:hidden print:!hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto flex max-w-md items-stretch justify-around px-2">
        {/* 1 — Launchpad */}
        <DockLink href="/command-center" label="Launchpad" active={isLaunchpad} Icon={LayoutGrid} />

        {/* 2 — Search (⌘K spotlight) */}
        <DockButton label="Search" onClick={onSearch} Icon={Search} />

        {/* 3 — Quick Upload — the emphasised centre action */}
        <Link
          href="/documents"
          aria-label="Quick upload"
          className="focus-ring flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 px-3 py-1.5"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
            <Plus className="h-5 w-5" />
          </span>
          <span className="text-[10px] font-medium text-muted-foreground">Upload</span>
        </Link>

        {/* 4 — Alerts (Bento) */}
        <DockLink href="/command-center#alerts" label="Alerts" active={false} Icon={Bell} />
      </div>
    </nav>
  );
}

function DockLink({ href, label, active, Icon }: { href: string; label: string; active: boolean; Icon: typeof Bell }) {
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'focus-ring flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 px-3 py-1.5 transition-colors',
        active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <Icon className="h-5 w-5" />
      <span className="text-[10px] font-medium">{label}</span>
    </Link>
  );
}

function DockButton({ label, onClick, Icon }: { label: string; onClick: () => void; Icon: typeof Bell }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="focus-ring flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 px-3 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
    >
      <Icon className="h-5 w-5" />
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}
