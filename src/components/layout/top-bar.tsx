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
    <header className="app-topbar sticky top-0 z-30 hidden items-center gap-2 border-b bg-background/85 px-4 backdrop-blur md:flex sm:px-6 lg:px-8 print:!hidden">
      {/* Tablet menu button — the sidebar is a drawer below lg. */}
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenu} aria-label="Open menu">
        <Menu className="h-5 w-5" />
      </Button>

      {/* Ameya Heights logo mark → Launchpad. */}
      <Link href="/command-center" aria-label="Ameya Heights — Launchpad" className="focus-ring flex shrink-0 items-center gap-2 rounded-md px-1 py-1">
        <img src="/brand/mark-gold-dark.svg" alt="" className="hidden h-6 w-6 select-none dark:block" />
        <img src="/brand/mark-gold-light.svg" alt="" className="h-6 w-6 select-none dark:hidden" />
        <span className="hidden text-sm font-semibold tracking-tight xl:inline">Ameya&nbsp;Heights</span>
      </Link>

      {/* Dynamic project selector banner. */}
      <div className="hidden sm:block">
        <ProjectSwitcher projects={projects} activeId={activeProjectId} activeName={activeProjectName} canAdd={isSuperAdmin || allowed.has('admin.project.manage')} />
      </div>

      {/* ⌘K Spotlight search. */}
      <button
        onClick={onSearch}
        className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border bg-secondary/50 px-2.5 text-sm text-muted-foreground transition-colors hover:bg-secondary sm:px-3 sm:max-w-md"
        aria-label="Open search (Command-K)"
      >
        <Search className="h-4 w-4" />
        <span className="truncate">Search or jump to…</span>
        <kbd className="ml-auto hidden rounded border bg-background px-1.5 text-[10px] sm:inline">⌘K</kbd>
      </button>

      <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1">
        {/* Universal file-upload trigger. */}
        <Link
          href="/documents"
          title="Upload files — drag & drop CSV, Excel, PDFs and photos"
          aria-label="Upload files"
          className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <UploadCloud className="h-4 w-4 shrink-0" />
          <span className="hidden text-xs font-medium xl:inline">Upload</span>
        </Link>

        <TopLink href="/chat" label="Messages" desc="Chat anyone in the company by @username" Icon={MessageSquare} />
        <TopLink href="/assistant" label="Assistant" desc="Draft, explain and summarise with AI" Icon={Sparkles} />
        <TopLink href="/tally" label="Ameya Tally" desc="Keyboard accounting — F4–F9, Day Book, Trial Balance, P&L" Icon={BookOpen} />
        <TopLink href="/features" label="Explore features" desc="Everything the CRM can do" Icon={LayoutGrid} />
        <GuidedTour />
        <NewButton allowed={allowed} isSuperAdmin={isSuperAdmin} />
        <NotificationsBell userId={user.id} />
        <div className="hidden sm:block"><DisplaySettings /></div>
        <ThemeToggle />
        <UserMenu user={user} />
      </div>
    </header>
  );
}

/** A top-bar shortcut: icon everywhere, a text label on wide screens, and a
    descriptive tooltip on hover so it's clear what each one does. */
function TopLink({ href, label, desc, Icon }: { href: string; label: string; desc: string; Icon: typeof Menu }) {
  return (
    <Link
      href={href}
      title={`${label} — ${desc}`}
      aria-label={`${label}: ${desc}`}
      className="focus-ring hidden h-9 items-center gap-1.5 rounded-md px-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground lg:inline-flex"
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="hidden text-xs font-medium xl:inline">{label}</span>
    </Link>
  );
}
