'use client';
import * as React from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './sidebar';
import { TopBar } from './top-bar';
import { BrandWatermark } from './brand-watermark';
import { Breadcrumbs } from './breadcrumbs';
import { CommandPalette } from './command-palette';
import { ShortcutsHelp } from './shortcuts-help';
import { MobileDock } from './mobile-dock';
import { SubNav } from './sub-nav';
import { DemoBanner } from './demo-banner';
import type { TopNavPrefs } from '@/lib/nav/top-nav-prefs';
import { NavProgress } from './nav-progress';
import { OfflineOutbox } from './offline-outbox';
import { WhatsNew } from './whats-new';
import { UpdateBanner } from '@/components/pwa/update-banner';
import { NotificationPrompt } from '@/components/pwa/notification-prompt';
import { AssistantLauncher } from '@/components/assistant/assistant-launcher';
import { PullToRefresh } from './pull-to-refresh';
import type { NavPrefs } from '@/lib/nav/prefs';
import type { ProjectOption } from './project-switcher';

export interface ShellUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: string;
  designation: string | null;
}

export function AppShell({
  user,
  permissionKeys,
  isSuperAdmin,
  navPrefs,
  topNavPrefs,
  projects,
  activeProjectId,
  activeProjectName,
  isGuest = false,
  children,
}: {
  user: ShellUser;
  permissionKeys: string[];
  isSuperAdmin: boolean;
  navPrefs: NavPrefs;
  topNavPrefs?: TopNavPrefs;
  projects: ProjectOption[];
  activeProjectId: string | null;
  activeProjectName: string;
  /** Demo mode: swaps the module row for the demo's own, and shows the banner. */
  isGuest?: boolean;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const pathname = usePathname();

  // Swipe from the left edge to open the menu, and swipe left to close it.
  // Only from the very edge, so it never fights a horizontally scrolling table.
  React.useEffect(() => {
    let startX = 0;
    let startY = 0;
    let tracking = false;

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      startX = t.clientX;
      startY = t.clientY;
      tracking = mobileOpen || startX < 24;
    };
    const onEnd = (e: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - startX;
      const dy = Math.abs(t.clientY - startY);
      // Mostly horizontal, and a real distance — not a stray thumb.
      if (dy > 60 || Math.abs(dx) < 60) return;
      if (dx > 0 && !mobileOpen) setMobileOpen(true);
      if (dx < 0 && mobileOpen) setMobileOpen(false);
    };

    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchend', onEnd);
    };
  }, [mobileOpen]);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const allowed = React.useMemo(() => new Set(permissionKeys), [permissionKeys]);

  // Desktop "icon rail" collapse — like the Google Cloud console. Off by default;
  // remembered per device once the person picks. Only affects the `lg:` layout,
  // so on a phone the drawer is always the full, labelled menu.
  const RAIL_KEY = 'amh:nav-rail';
  const [rail, setRail] = React.useState(false);
  React.useEffect(() => {
    try { setRail(window.localStorage.getItem(RAIL_KEY) === '1'); } catch { /* ignore */ }
  }, []);
  const toggleRail = React.useCallback((v?: boolean) => {
    setRail((prev) => {
      const next = typeof v === 'boolean' ? v : !prev;
      try { window.localStorage.setItem(RAIL_KEY, next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  }, []);

  return (
    <div className="flex min-h-screen min-h-[100dvh] bg-background">
      {/* Ameya emblem watermark — a faint, fixed brand mark behind all content.
          Centralised in <BrandWatermark/>; mirrors the sidebar rail offset so it
          stays optically centred whether the rail is open or collapsed. */}
      <BrandWatermark variant="workspace" padClassName={rail ? 'lg:pl-[4.5rem]' : 'lg:pl-72'} />
      {/* Batch 12 (a11y): the first focusable element lets a keyboard or
          screen-reader user jump straight past the sidebar to the page content. */}
      <a
        href="#main"
        className="focus-ring sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <React.Suspense fallback={null}>
        <NavProgress />
      </React.Suspense>
      <PullToRefresh />
      <Sidebar
        allowed={allowed}
        isSuperAdmin={isSuperAdmin}
        mobileOpen={mobileOpen}
        navPrefs={navPrefs}
        collapsed={rail}
        onToggleRail={toggleRail}
        onClose={() => setMobileOpen(false)}
      />
      <div className={`relative z-10 flex min-w-0 flex-1 flex-col transition-[padding] duration-200 print:!pl-0 ${rail ? 'lg:pl-[4.5rem]' : 'lg:pl-72'}`}>
        <UpdateBanner />
        {isGuest && <DemoBanner />}
        {/* Ameya OS desktop Top-Bar (md+). On phones the Mobile Dock takes over. */}
        <TopBar user={user} projects={projects} activeProjectId={activeProjectId} activeProjectName={activeProjectName} allowed={allowed} isSuperAdmin={isSuperAdmin} onMenu={() => setMobileOpen(true)} onSearch={() => setPaletteOpen(true)} />
        <SubNav allowed={allowed} isSuperAdmin={isSuperAdmin} prefs={topNavPrefs} isGuest={isGuest} />
        <OfflineOutbox />
        <Breadcrumbs />
        {/* Keyed by route so page content eases in on every navigation — makes
            the app feel responsive and alive (U14). Honours reduced-motion. */}
        <main id="main" tabIndex={-1} className="w-full max-w-none flex-1 px-4 py-5 pb-[calc(6.5rem+env(safe-area-inset-bottom))] focus:outline-none sm:px-6 sm:py-6 lg:px-8 lg:pb-24">
          <div key={pathname} className="animate-in mx-auto w-full max-w-[1800px]">{children}</div>
        </main>
      </div>
      {/* Ameya OS mobile Dock (< md) — Launchpad · Search · Quick-Upload · Alerts. */}
      <MobileDock onSearch={() => setPaletteOpen(true)} />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} allowed={allowed} isSuperAdmin={isSuperAdmin} />
      <ShortcutsHelp />
      <AssistantLauncher />
      <NotificationPrompt />
      <WhatsNew />
    </div>
  );
}
