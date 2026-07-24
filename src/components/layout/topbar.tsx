'use client';
import Link from 'next/link';
import { Menu, Search, LayoutGrid, MessageSquare, Sparkles, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from './theme-toggle';
import { DisplaySettings } from './display-settings';
import { NewButton } from './new-button';
import { UserMenu } from './user-menu';
import { NotificationsBell } from './notifications-bell';
import type { ShellUser } from './app-shell';
import { ProjectSwitcher, type ProjectOption } from './project-switcher';

export function Topbar({
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
    <header className="app-topbar sticky top-0 z-30 flex items-center gap-2 border-b bg-background/85 px-3 backdrop-blur sm:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenu} aria-label="Open menu">
        <Menu className="h-5 w-5" />
      </Button>

      <div className="hidden sm:block"><ProjectSwitcher projects={projects} activeId={activeProjectId} activeName={activeProjectName} canAdd={isSuperAdmin || allowed.has('admin.project.manage')} /></div>

      <button
        onClick={onSearch}
        className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border bg-secondary/50 px-2.5 text-sm text-muted-foreground transition-colors hover:bg-secondary sm:px-3 sm:max-w-md"
      >
        <Search className="h-4 w-4" />
        <span className="truncate">Search…</span>
        <kbd className="ml-auto hidden rounded border bg-background px-1.5 text-[10px] sm:inline">⌘K</kbd>
      </button>

      <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1">
        <TopLink href="/chat" label="Messages" desc="Chat anyone in the company by @username" Icon={MessageSquare} />
        <TopLink href="/assistant" label="Assistant" desc="Draft, explain and summarise with AI" Icon={Sparkles} />
        <TopLink href="/tally" label="Ameya Tally" desc="Keyboard accounting — F4–F9, Day Book, Trial Balance, P&L" Icon={BookOpen} />
        <TopLink href="/features" label="Explore features" desc="Everything the CRM can do" Icon={LayoutGrid} />
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
      className="focus-ring hidden h-9 items-center gap-1.5 rounded-md px-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground sm:inline-flex"
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="hidden text-xs font-medium xl:inline">{label}</span>
    </Link>
  );
}
