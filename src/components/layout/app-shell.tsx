'use client';
import * as React from 'react';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';
import { CommandPalette } from './command-palette';
import { MobileNav } from './mobile-nav';

export interface ShellUser {
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
  children,
}: {
  user: ShellUser;
  permissionKeys: string[];
  isSuperAdmin: boolean;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const allowed = React.useMemo(() => new Set(permissionKeys), [permissionKeys]);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        allowed={allowed}
        isSuperAdmin={isSuperAdmin}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <Topbar user={user} onMenu={() => setMobileOpen(true)} onSearch={() => setPaletteOpen(true)} />
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-5 pb-[calc(4.5rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-6 lg:px-8 lg:pb-8">{children}</main>
      </div>
      <MobileNav allowed={allowed} isSuperAdmin={isSuperAdmin} onMore={() => setMobileOpen(true)} />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} allowed={allowed} isSuperAdmin={isSuperAdmin} />
    </div>
  );
}
