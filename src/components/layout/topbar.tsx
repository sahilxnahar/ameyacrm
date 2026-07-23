'use client';
import Link from 'next/link';
import { Menu, Search, LayoutGrid, MessageSquare, Sparkles } from 'lucide-react';
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
        <Link
          href="/chat"
          title="Messages — chat anyone in the company"
          aria-label="Messages"
          className="focus-ring hidden h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground sm:inline-flex"
        >
          <MessageSquare className="h-4 w-4" />
        </Link>
        <Link
          href="/assistant"
          title="Assistant — draft, explain, summarise"
          aria-label="Assistant"
          className="focus-ring hidden h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground sm:inline-flex"
        >
          <Sparkles className="h-4 w-4" />
        </Link>
        <Link
          href="/features"
          title="Explore features — everything the CRM can do"
          aria-label="Explore features"
          className="focus-ring hidden h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground sm:inline-flex"
        >
          <LayoutGrid className="h-4 w-4" />
        </Link>
        <NewButton allowed={allowed} isSuperAdmin={isSuperAdmin} />
        <NotificationsBell userId={user.id} />
        <div className="hidden sm:block"><DisplaySettings /></div>
        <ThemeToggle />
        <UserMenu user={user} />
      </div>
    </header>
  );
}
