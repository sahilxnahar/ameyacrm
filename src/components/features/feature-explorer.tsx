'use client';
import * as React from 'react';
import Link from 'next/link';
import { Search, X } from 'lucide-react';
import { NAVIGATION } from '@/config/navigation';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';

/**
 * A browsable, searchable directory of everything the CRM can do — grouped by
 * area, each with a one-line plain-language description. It's the "what's in
 * here?" map: type to filter, click any card to go straight there. Only shows
 * what this person is allowed to open.
 */
export function FeatureExplorer({ allowed, isSuperAdmin }: { allowed: string[]; isSuperAdmin: boolean }) {
  const [query, setQuery] = React.useState('');
  const allowedSet = React.useMemo(() => new Set(allowed), [allowed]);
  const canSee = React.useCallback(
    (perm?: string) => !perm || isSuperAdmin || allowedSet.has(perm),
    [allowedSet, isSuperAdmin],
  );

  const q = query.trim().toLowerCase();
  const groups = React.useMemo(() => {
    return NAVIGATION.map((g) => {
      const items = g.items.filter((i) => canSee(i.permission)).filter((i) => {
        if (!q) return true;
        return (
          i.label.toLowerCase().includes(q) ||
          (i.blurb ?? '').toLowerCase().includes(q) ||
          g.label.toLowerCase().includes(q)
        );
      });
      return { label: g.label, blurb: g.blurb, items };
    }).filter((g) => g.items.length > 0);
  }, [q, canSee]);

  const total = React.useMemo(
    () => NAVIGATION.reduce((n, g) => n + g.items.filter((i) => canSee(i.permission)).length, 0),
    [canSee],
  );

  return (
    <div className="space-y-6">
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${total} features…`}
          className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-9 text-sm focus:border-primary focus:outline-none"
          autoFocus
        />
        {query && (
          <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Clear">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {groups.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Nothing matches “{query}”. Try another word.</p>
      ) : (
        groups.map((g) => (
          <section key={g.label}>
            <div className="mb-2">
              <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">{g.label}</h2>
              {g.blurb && <p className="mt-0.5 text-xs text-muted-foreground/80">{g.blurb}</p>}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {g.items.map((i) => {
                const Icon = i.icon;
                return (
                  <Link key={i.href} href={i.href}>
                    <Card className={cn('flex h-full items-start gap-3 p-3.5 transition-colors hover:border-primary hover:bg-secondary/40')}>
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">{i.label}</span>
                        {i.blurb && <span className="mt-0.5 block text-xs text-muted-foreground">{i.blurb}</span>}
                      </span>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
