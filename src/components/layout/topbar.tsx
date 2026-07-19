'use client';
import { Menu, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from './theme-toggle';
import { UserMenu } from './user-menu';
import { NotificationsBell } from './notifications-bell';
import type { ShellUser } from './app-shell';

export function Topbar({ user, onMenu, onSearch }: { user: ShellUser; onMenu: () => void; onSearch: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur sm:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenu} aria-label="Open menu">
        <Menu className="h-5 w-5" />
      </Button>

      <button
        onClick={onSearch}
        className="flex h-9 flex-1 items-center gap-2 rounded-md border bg-secondary/50 px-3 text-sm text-muted-foreground transition-colors hover:bg-secondary sm:max-w-md"
      >
        <Search className="h-4 w-4" />
        <span>Search everything…</span>
        <kbd className="ml-auto hidden rounded border bg-background px-1.5 text-[10px] sm:inline">⌘K</kbd>
      </button>

      <div className="ml-auto flex items-center gap-1">
        <NotificationsBell />
        <ThemeToggle />
        <UserMenu user={user} />
      </div>
    </header>
  );
}
