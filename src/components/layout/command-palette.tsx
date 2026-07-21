'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import { Loader2, CornerDownLeft } from 'lucide-react';
import { NAVIGATION } from '@/config/navigation';
import { SEARCH_ALIASES } from '@/config/search-aliases';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { searchRecords, type CommandHit } from '@/server/actions/search';

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
  const [q, setQ] = React.useState('');
  const [hits, setHits] = React.useState<CommandHit[]>([]);
  const [loading, setLoading] = React.useState(false);

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

  // Reset when the palette closes, so it opens fresh next time.
  React.useEffect(() => {
    if (!open) { setQ(''); setHits([]); setLoading(false); }
  }, [open]);

  // Debounced record search. A ref tracks the latest query so a slow response
  // for an old keystroke cannot overwrite a newer one.
  const latest = React.useRef('');
  React.useEffect(() => {
    latest.current = q;
    const term = q.trim();
    if (term.length < 2) { setHits([]); setLoading(false); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      const res = await searchRecords(term);
      if (latest.current === q) { setHits(res); setLoading(false); }
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  const go = (href: string) => { onOpenChange(false); router.push(href); };
  const canSee = (perm?: string) => !perm || isSuperAdmin || allowed.has(perm);

  const term = q.trim().toLowerCase();
  const aliasHit = (href: string) => (SEARCH_ALIASES[href] ?? []).some((a) => a.includes(term) || term.includes(a));
  const navGroups = NAVIGATION.map((group) => ({
    label: group.label,
    items: group.items.filter((i) => canSee(i.permission) && (!term || i.label.toLowerCase().includes(term) || (i.blurb ?? '').toLowerCase().includes(term) || aliasHit(i.href))),
  })).filter((g) => g.items.length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0">
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        {/* shouldFilter is off: navigation is filtered above and records come
            back already matched, so cmdk only handles keyboard selection. */}
        <Command shouldFilter={false} className="[&_[cmdk-input]]:h-12">
          <div className="flex items-center gap-2 border-b px-4">
            <Command.Input
              value={q}
              onValueChange={setQ}
              placeholder="Jump to a page, or search leads, tasks, buyers, parcels…"
              className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
          </div>
          <Command.List className="max-h-96 overflow-y-auto p-2">
            {navGroups.length === 0 && hits.length === 0 && !loading && (
              <Command.Empty className="p-4 text-sm text-muted-foreground">No results.</Command.Empty>
            )}

            {navGroups.map((group) => (
              <Command.Group
                key={group.label}
                heading={group.label}
                className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground [&_[cmdk-group-items]]:mt-1"
              >
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Command.Item
                      key={item.href}
                      value={`nav:${item.href}`}
                      onSelect={() => go(item.href)}
                      className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm text-foreground aria-selected:bg-secondary"
                    >
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate">{item.label}</span>
                        {item.blurb && <span className="truncate text-[11px] text-muted-foreground">{item.blurb}</span>}
                      </span>
                    </Command.Item>
                  );
                })}
              </Command.Group>
            ))}

            {hits.length > 0 && (
              <Command.Group
                heading="Records"
                className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground [&_[cmdk-group-items]]:mt-1"
              >
                {hits.map((hit) => (
                  <Command.Item
                    key={`${hit.type}-${hit.id}`}
                    value={`rec:${hit.type}:${hit.id}`}
                    onSelect={() => go(hit.href)}
                    className="group flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm text-foreground aria-selected:bg-secondary"
                  >
                    <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{hit.type}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{hit.title}</span>
                      {hit.subtitle && <span className="block truncate text-xs text-muted-foreground">{hit.subtitle}</span>}
                    </span>
                    <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 group-aria-selected:opacity-100" />
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
