'use client';
import Link from 'next/link';
import { LogOut, Settings, User } from 'lucide-react';
import { useTransition } from 'react';
import { logoutAction } from '@/server/actions/auth';
import { initials } from '@/lib/utils/format';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ShellUser } from './app-shell';

export function UserMenu({ user }: { user: ShellUser }) {
  const [signingOut, startSignOut] = useTransition();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="focus-ring rounded-full">
        <Avatar>
          {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
          <AvatarFallback>{initials(user.name)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>
          <div className="flex flex-col">
            <span className="font-semibold">{user.name}</span>
            <span className="text-xs font-normal text-muted-foreground">{user.email}</span>
            <span className="mt-1 text-[10px] font-normal uppercase tracking-wide text-primary">
              {user.designation ?? user.role}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings/profile"><User className="h-4 w-4" /> Profile</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings/security"><Settings className="h-4 w-4" /> Security &amp; 2FA</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {/*
          * Sign out is a menu item that runs the action itself, not a submit
          * button wrapped in one. Nesting a form inside a menu item meant that
          * choosing "Sign out" closed the menu — unmounting the form — before
          * the browser got round to submitting it, so roughly one tap in two
          * did nothing at all and there was no error to show for it.
          */}
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          disabled={signingOut}
          onSelect={(e) => {
            e.preventDefault();
            startSignOut(async () => { await logoutAction(); });
          }}
        >
          <LogOut className="h-4 w-4" /> {signingOut ? 'Signing out…' : 'Sign out'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
