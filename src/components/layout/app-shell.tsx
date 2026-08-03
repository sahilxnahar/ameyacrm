'use client';
import * as React from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './sidebar';
import { TopBar } from './top-bar';
import { BrandWatermark } from './brand-watermark';
import { Breadcrumbs } from './breadcrumbs';
import { MobileDock } from './mobile-dock';
import { SubNav } from './sub-nav';
import { KeyboardShortcuts } from './keyboard-shortcuts';
import { DemoBanner } from './demo-banner';
import type { TopNavPrefs } from '@/lib/nav/top-nav-prefs';
import type { NavMode } from '@/lib/nav/nav-mode';
import { NavProgress } from './nav-progress';
import type { NavPrefs } from '@/lib/nav/prefs';
import { NAVIGATION } from '@/config/navigation';
import { toneForPath } from '@/config/module-style';
import nextDynamic from 'next/dynamic';

/*
 * Chrome that nobody has opened yet.
 *
 * All of these render nothing until something happens — a keystroke, a click, an
 * upgrade, losing connectivity. They were imported at the top of this file,
 * which wraps all 172 signed-in routes, so their code was downloaded, parsed and
 * hydrated on every single page load before the page you actually asked for
 * could become interactive. That is what "the buttons don't work" is: the screen
 * is painted from the server, but React has not finished hydrating, so nothing
 * responds yet.
 *
 * Loading them on demand takes that work off the critical path. `ssr: false`
 * because none of them contributes anything to the first paint.
 */
const CommandPalette = nextDynamic(() => import('./command-palette').then((m) => m.CommandPalette), { ssr: false });
const ShortcutsHelp = nextDynamic(() => import('./shortcuts-help').then((m) => m.ShortcutsHelp), { ssr: false });
const WhatsNew = nextDynamic(() => import('./whats-new').then((m) => m.WhatsNew), { ssr: false });
const OfflineOutbox = nextDynamic(() => import('./offline-outbox').then((m) => m.OfflineOutbox), { ssr: false });
const PullToRefresh = nextDynamic(() => import('./pull-to-refresh').then((m) => m.PullToRefresh), { ssr: false });
const AssistantLauncher = nextDynamic(() => import('@/components/assistant/assistant-launcher').then((m) => m.AssistantLauncher), { ssr: false });
const NotificationPrompt = nextDynamic(() => import('@/components/pwa/notification-prompt').then((m) => m.NotificationPrompt), { ssr: false });
const UpdateBanner = nextDynamic(() => import('@/components/pwa/update-banner').then((m) => m.UpdateBanner), { ssr: false });

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
  navMode,
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
  navMode?: NavMode;
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
  // The sidebar's "Browse all" entry opens the palette without needing a prop
  // threaded through every layer between them.
  const openPalette = React.useCallback(() => setPaletteOpen(true), []);
  React.useEffect(() => {
    const open = () => setPaletteOpen(true);
    window.addEventListener('amh:open-palette', open);
    return () => window.removeEventListener('amh:open-palette', open);
  }, []);
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

  /*
   * Collapse to the icon rail by default on a small laptop.
   *
   * The sidebar is a fixed 18rem from 1024px upwards. On a 13" screen that is
   * 288 of 1280 pixels — nearly a quarter of the display — and what is left
   * after the page gutters is a ~900px column, which is exactly the width at
   * which toolbars start wrapping and four summary cards stop fitting. Almost
   * every alignment complaint on a 13" traces back to that one number.
   *
   * So below 1440px the rail is the default. It is still only a default: the
   * moment somebody expands or collapses it themselves, that choice is stored
   * and this never overrides it again, on any screen.
   */
  React.useEffect(() => {
    let chosen = true;
    try { chosen = window.localStorage.getItem(RAIL_KEY) !== null; } catch { /* ignore */ }
    if (chosen) return;
    const mq = window.matchMedia('(min-width: 1024px) and (max-width: 1439.98px)');
    const apply = () => setRail(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
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
        navMode={navMode}
        topNavPrefs={topNavPrefs}
        collapsed={rail}
        onToggleRail={toggleRail}
        onClose={() => setMobileOpen(false)}
      />
      <div className={`relative z-10 flex min-w-0 flex-1 flex-col transition-[padding] duration-200 print:!pl-0 ${rail ? 'lg:pl-[4.5rem]' : 'lg:pl-72'}`}>
        <UpdateBanner />
        {isGuest && <DemoBanner />}
        {/* Ameya OS desktop Top-Bar (md+). On phones the Mobile Dock takes over. */}
        <TopBar user={user} projects={projects} activeProjectId={activeProjectId} activeProjectName={activeProjectName} allowed={allowed} isSuperAdmin={isSuperAdmin} onMenu={() => setMobileOpen(true)} onSearch={() => setPaletteOpen(true)} />
        {/*
          * Batch 2 — fewer navigation layers.
          *
          * This second row duplicated the sidebar: the same modules, listed
          * twice, on every page. It existed because the top bar was overcrowded
          * on a 13" screen; with the sidebar now short, the modules have a home
          * and the row is redundant. It stays for the demo (whose nav lives
          * here) and for anyone on the full "Everything" menu, who has opted
          * into seeing more rather than less.
          */}
        {(isGuest || navMode === 'everything') && (
          <SubNav allowed={allowed} isSuperAdmin={isSuperAdmin} prefs={topNavPrefs} isGuest={isGuest} />
        )}
        <OfflineOutbox />
        <Breadcrumbs />
        {/* Keyed by route so page content eases in on every navigation — makes
            the app feel responsive and alive (U14). Honours reduced-motion. */}
        <main id="main" tabIndex={-1} className="w-full max-w-none flex-1 px-4 py-5 pb-[calc(6.5rem+env(safe-area-inset-bottom))] focus:outline-none sm:px-6 sm:py-6 lg:px-8 lg:pb-24">
          {/*
            * A capped, centred column.
            *
            * 1800px was effectively uncapped: on a 27" monitor a line of text ran
            * the full width and the eye loses the line on the way back. 1400px is
            * wide enough for the big tables and matrices while keeping prose
            * readable. Screens that genuinely need every pixel opt out with
            * `page-wide` on their own wrapper.
            */}
          {/* One attribute is all it takes for every screen to carry its area's
              colour: the page header and anything else that wants it reads
              `var(--tone)`, which the CSS derives from this. */}
          <div
            key={pathname}
            data-tone={toneForPath(pathname ?? '', NAVIGATION)}
            className="page-container animate-in mx-auto w-full max-w-[1400px]"
          >{children}</div>
        </main>
      </div>
      {/* Ameya OS mobile Dock (< md) — Launchpad · Search · Quick-Upload · Alerts. */}
      <MobileDock onSearch={() => setPaletteOpen(true)} />
      <KeyboardShortcuts onOpenSearch={openPalette} isGuest={isGuest} />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} allowed={allowed} isSuperAdmin={isSuperAdmin} />
      <ShortcutsHelp />
      <AssistantLauncher />
      <NotificationPrompt />
      <WhatsNew />
    </div>
  );
}
