'use client';
import Link from 'next/link';
import { Menu, Search, UploadCloud, LayoutGrid, MessageSquare, Sparkles, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from './theme-toggle';
import { DisplaySettings } from './display-settings';
import { NewButton } from './new-button';
import { UserMenu } from './user-menu';
import { NotificationsBell } from './notifications-bell';
import { GuidedTour } from './guided-tour';
import { ProjectSwitcher, type ProjectOption } from './project-switcher';
import type { ShellUser } from './app-shell';

/**
 * The Ameya OS desktop Top-Bar. Shown on `md` and up (`hidden md:flex`); on phones
 * the Mobile Dock takes over. It composes the existing, battle-tested controls
 * (project switcher, ⌘K search, notifications, user menu) so no functionality is
 * lost from the legacy top bar, and adds two Ameya OS elements:
 *   - the official logo mark (links to the Launchpad), and
 *   - a universal file-upload trigger (drops you into the document dropzone).
 *
 * A menu button appears only below `lg`, where the sidebar is a drawer, so tablets
 * can still open the full navigation.
 */
export function TopBar({
  user, projects, activeProjectId, activeProjectName, allowed, isSuperAdmin, onMenu, onSearch,
}: {
  user: ShellUser;
  projects: ProjectOption[];
  activeProjectId: string | null;
  activeProjectName: string;
  allowed: Set<string>;
  isSuperAdmin: boolean;
  onMenu: () => void;
  onSearch: () => void;
}) {
  return (
    <header className="app-topbar sticky top-0 z-sticky hidden items-center gap-2 border-b bg-background/85 px-4 backdrop-blur md:flex sm:px-6 lg:px-8 print:!hidden">
      {/* Tablet menu button — the sidebar is a drawer below lg. */}
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenu} aria-label="Open menu">
        <Menu className="h-5 w-5" />
      </Button>

      {/* Ameya Heights logo mark → Launchpad. */}
      <Link href="/command-center" data-tour="brand" aria-label="Ameya Heights — Launchpad" className="focus-ring flex shrink-0 items-center gap-2 rounded-md px-1 py-1">
        <img src="/brand/mark-gold-dark.svg" alt="" className="hidden h-6 w-6 select-none dark:block" />
        <img src="/brand/mark-gold-light.svg" alt="" className="h-6 w-6 select-none dark:hidden" />
        <span className="hidden text-sm font-semibold tracking-tight 2xl:inline">Ameya&nbsp;Heights</span>
      </Link>

      {/* Dynamic project selector banner. */}
      <div className="hidden sm:block">
        <ProjectSwitcher projects={projects} activeId={activeProjectId} activeName={activeProjectName} canAdd={isSuperAdmin || allowed.has('admin.project.manage')} />
      </div>

      {/* ⌘K Spotlight search. */}
      <button
        onClick={onSearch}
        data-tour="search"
        className="flex h-9 min-w-[4.5rem] flex-1 items-center gap-2 rounded-md border bg-secondary/50 px-2.5 text-sm text-muted-foreground transition-colors hover:bg-secondary sm:px-3 sm:max-w-md"
        aria-label="Open search (Command-K)"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="truncate">Search or jump to…</span>
        <kbd className="ml-auto hidden shrink-0 rounded border bg-background px-1.5 text-[10px] lg:inline">⌘K</kbd>
      </button>

      {/* Module links (Sales, Tally, Messages, Assistant…) now live in <SubNav/>,
          the row directly below this one. Keeping them here crammed a dozen
          controls into a single row, which collided on a 13" laptop. */}
      <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1">
        <GuidedTour />
        <NewButton allowed={allowed} isSuperAdmin={isSuperAdmin} />
        <span data-tour="alerts" className="inline-flex"><NotificationsBell userId={user.id} /></span>
        <div className="hidden sm:block"><DisplaySettings /></div>
        <ThemeToggle />
        <UserMenu user={user} />
      </div>
    </header>
  );
}
