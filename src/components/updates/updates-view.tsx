'use client';
import * as React from 'react';
import { Search, X, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';
import type { Release } from '@/config/changelog';

/**
 * A searchable log of every feature and change we've shipped, newest first.
 * Type in the box to find anything we've ever added — by name or by what it does.
 */
export function UpdatesView({ releases }: { releases: Release[] }) {
  const [q, setQ] = React.useState('');
  const term = q.trim().toLowerCase();

  const filtered = React.useMemo(() => {
    if (!term) return releases;
    return releases
      .map((r) => ({
        ...r,
        highlights: r.version.toLowerCase().includes(term)
          ? r.highlights
          : r.highlights.filter((h) => h.toLowerCase().includes(term)),
      }))
      .filter((r) => r.highlights.length > 0);
  }, [term, releases]);

  const totalFeatures = React.useMemo(() => releases.reduce((n, r) => n + r.highlights.length, 0), [releases]);
  const shownFeatures = filtered.reduce((n, r) => n + r.highlights.length, 0);

  return (
    <div className="space-y-5">
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Search ${totalFeatures} features & updates…`}
          className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-9 text-sm focus:border-primary focus:outline-none"
          autoFocus
        />
        {q && (
          <button onClick={() => setQ('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Clear">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {term && <p className="text-xs text-muted-foreground">{shownFeatures} match{shownFeatures === 1 ? '' : 'es'} for “{q}”.</p>}

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Nothing matches “{q}”. Try another word.</p>
      ) : (
        <div className="space-y-4">
          {filtered.map((r) => (
            <Card key={r.version} className="p-4 sm:p-5">
              <div className="mb-2 flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                  <Sparkles className="h-3 w-3" /> {r.version}
                </span>
                <span className="text-xs text-muted-foreground">{r.date}</span>
              </div>
              <ul className="space-y-1.5">
                {r.highlights.map((h, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/50')} />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
