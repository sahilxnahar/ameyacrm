'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import { NAVIGATION } from '@/config/navigation';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

export function CommandPalette({
  open,
  onOpenChange,
  allowed,
  isSuperAdmin,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  allowed: Set<string>;
  isSuperAdmin: boolean;
}) {
  const router = useRouter();

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };
  const canSee = (perm?: string) => !perm || isSuperAdmin || allowed.has(perm);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0">
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <Command className="[&_[cmdk-input]]:h-12">
          <Command.Input
            placeholder="Jump to… (type a page or action)"
            className="w-full border-b bg-transparent px-4 text-sm outline-none placeholder:text-muted-foreground"
          />
          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="p-4 text-sm text-muted-foreground">No results.</Command.Empty>
            {NAVIGATION.map((group) => {
              const items = group.items.filter((i) => canSee(i.permission));
              if (!items.length) return null;
              return (
                <Command.Group
                  key={group.label}
                  heading={group.label}
                  className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground [&_[cmdk-group-items]]:mt-1"
                >
                  {items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Command.Item
                        key={item.href}
                        value={item.label}
                        onSelect={() => go(item.href)}
                        className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm text-foreground aria-selected:bg-secondary"
                      >
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        {item.label}
                      </Command.Item>
                    );
                  })}
                </Command.Group>
              );
            })}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
