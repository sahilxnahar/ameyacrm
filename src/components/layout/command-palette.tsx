'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import { Loader2, CornerDownLeft, ExternalLink, UploadCloud, Search as SearchIcon } from 'lucide-react';
import { NAVIGATION } from '@/config/navigation';
import { SEARCH_ALIASES } from '@/config/search-aliases';
import { DD_AUTHORITIES_FLAT, authorityMatches } from '@/config/dd-authorities';
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
  const [recent, setRecent] = React.useState<string[]>([]);

  // Read the screens you were just on when the palette opens, so an empty search
  // offers instant "jump back" (U11).
  React.useEffect(() => {
    if (!open) return;
    try {
      const raw = window.localStorage.getItem('amh:recent-nav');
      const arr = raw ? (JSON.parse(raw) as unknown) : [];
      setRecent(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : []);
    } catch { setRecent([]); }
  }, [open]);

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
  const openPortal = (url: string) => { onOpenChange(false); if (typeof window !== 'undefined') window.open(url, '_blank', 'noopener,noreferrer'); };
  const canSee = (perm?: string) => !perm || isSuperAdmin || allowed.has(perm);

  const term = q.trim().toLowerCase();
  const aliasHit = (href: string) => (SEARCH_ALIASES[href] ?? []).some((a) => a.includes(term) || term.includes(a));
  const navGroups = NAVIGATION.map((group) => ({
    label: group.label,
    items: group.items.filter((i) => canSee(i.permission) && (!term || i.label.toLowerCase().includes(term) || (i.blurb ?? '').toLowerCase().includes(term) || aliasHit(i.href))),
  })).filter((g) => g.items.length > 0);

  const byHref = React.useMemo(() => {
    const m = new Map<string, (typeof NAVIGATION)[number]['items'][number]>();
    for (const g of NAVIGATION) for (const it of g.items) m.set(it.href, it);
    return m;
  }, []);
  const recentItems = recent
    .map((h) => byHref.get(h))
    .filter((i): i is NonNullable<typeof i> => Boolean(i) && canSee(i?.permission))
    .slice(0, 5);

  // Government-authority actions: "Open CMDA", "Upload RERA Certificate to …".
  // Only when the user has land access and has typed something meaningful.
  const authorityHits = React.useMemo(() => {
    if (term.length < 2 || !canSee('land.view')) return [];
    return DD_AUTHORITIES_FLAT.filter((a) => authorityMatches(a, term)).slice(0, 6);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term, isSuperAdmin]);

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
            {navGroups.length === 0 && hits.length === 0 && authorityHits.length === 0 && !loading && (
              <Command.Empty className="p-4 text-sm text-muted-foreground">No results.</Command.Empty>
            )}

            {!term && recentItems.length > 0 && (
              <Command.Group
                heading="Recent"
                className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground [&_[cmdk-group-items]]:mt-1"
              >
                {recentItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Command.Item
                      key={`recent-${item.href}`}
                      value={`recent:${item.href}`}
                      onSelect={() => go(item.href)}
                      className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm text-foreground aria-selected:bg-secondary"
                    >
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{item.label}</span>
                    </Command.Item>
                  );
                })}
              </Command.Group>
            )}

            {navGroups.map((group) => (
              <Command.Group
                key={group.label}
                heading={group.label}
                className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground [&_[cmdk-group-items]]:mt-1"
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

            {authorityHits.length > 0 && (
              <Command.Group
                heading="Authorities & portals"
                className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground [&_[cmdk-group-items]]:mt-1"
              >
                {authorityHits.map((a) => (
                  <React.Fragment key={`auth-${a.state}-${a.name}`}>
                    <Command.Item
                      value={`auth-open:${a.name}`}
                      onSelect={() => openPortal(a.url)}
                      className="group flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm text-foreground aria-selected:bg-secondary"
                    >
                      <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1"><span className="block truncate">Open {a.name}</span><span className="block truncate text-[11px] text-muted-foreground">{a.state}{a.region ? ` · ${a.region}` : ''} — official portal</span></span>
                    </Command.Item>
                    <Command.Item
                      value={`auth-upload:${a.name}`}
                      onSelect={() => go(`/due-diligence?authority=${encodeURIComponent(a.name)}&action=upload`)}
                      className="group flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm text-foreground aria-selected:bg-secondary"
                    >
                      <UploadCloud className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1"><span className="block truncate">File a record from {a.name}</span><span className="block truncate text-[11px] text-muted-foreground">Opens the vault with the upload box ready</span></span>
                    </Command.Item>
                  </React.Fragment>
                ))}
              </Command.Group>
            )}

            {hits.length > 0 && (
              <Command.Group
                heading="Records"
                className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground [&_[cmdk-group-items]]:mt-1"
              >
                {hits.map((hit) => (
                  <Command.Item
                    key={`${hit.type}-${hit.id}`}
                    value={`rec:${hit.type}:${hit.id}`}
                    onSelect={() => go(hit.href)}
                    className="group flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm text-foreground aria-selected:bg-secondary"
                  >
                    <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">{hit.type}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{hit.title}</span>
                      {hit.subtitle && <span className="block truncate text-xs text-muted-foreground">{hit.subtitle}</span>}
                    </span>
                    <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 group-aria-selected:opacity-100" />
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/*
              AMH-046 — the way into the full-page search.

              /app/(app)/search exists, works, and searches more than this
              palette does. Nothing anywhere linked to it, so it had never been
              opened by anyone who did not type the URL.

              A nav item would have been the wrong fix: the palette IS the
              search most of the time. What it is not is complete — the record
              results are capped at a handful. This offers the full list at the
              moment somebody has typed a query and not found what they wanted,
              which is the only moment they want it.
            */}
            {term && (
              <Command.Item
                value={`__all__:${term}`}
                onSelect={() => go(`/search?q=${encodeURIComponent(term)}`)}
                className="mt-1 flex cursor-pointer items-center gap-3 rounded-md border-t px-2 py-2 pt-3 text-sm text-muted-foreground aria-selected:bg-secondary"
              >
                <SearchIcon className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">
                  See all results for <span className="font-medium text-foreground">{term}</span>
                </span>
                <CornerDownLeft className="h-3.5 w-3.5 shrink-0 opacity-0 group-aria-selected:opacity-100" />
              </Command.Item>
            )}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
