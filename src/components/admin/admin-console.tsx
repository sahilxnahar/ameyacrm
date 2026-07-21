'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, CornerDownLeft } from 'lucide-react';
import { ADMIN_GROUPS, ALL_ADMIN_TOOLS, type AdminTool } from '@/config/admin-console';

/**
 * The admin landing page as a searchable console.
 *
 * Twenty-five settings pages as one flat grid meant hunting. Typing filters
 * everything instantly, and Enter opens the first match — so "whatsapp" and
 * Enter gets you to Connected Accounts without touching the mouse.
 */
export function AdminConsole({ allowed }: { allowed: string[] }) {
  const [q, setQ] = useState('');
  const can = useMemo(() => new Set(allowed), [allowed]);
  const visible = (t: AdminTool) => !t.permission || can.has(t.permission) || can.has('*');

  const needle = q.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!needle) return null;
    return ALL_ADMIN_TOOLS.filter(visible).filter((t) =>
      `${t.title} ${t.desc} ${t.keywords ?? ''}`.toLowerCase().includes(needle),
    );
  }, [needle, allowed]);

  const first = matches?.[0];

  return (
    <div className="mb-8 space-y-5">
      <form
        onSubmit={(e) => { e.preventDefault(); if (first) window.location.href = first.href; }}
        className="relative"
      >
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off"
          placeholder="Search settings — try whatsapp, gst, password, slow…"
          aria-label="Search admin settings"
          className="focus-ring w-full rounded-lg border bg-card py-3 pl-10 pr-24 text-base shadow-sm"
        />
        {first && (
          <span className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-1 text-xs text-muted-foreground sm:flex">
            <CornerDownLeft className="h-3 w-3" />{first.title}
          </span>
        )}
      </form>

      {matches ? (
        matches.length === 0 ? (
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Nothing matches &ldquo;{q}&rdquo;. Try a word from the thing you are looking for — a bank, a person, a message.
          </p>
        ) : (
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">{matches.length} match{matches.length === 1 ? '' : 'es'}</p>
            <ToolGrid tools={matches} />
          </div>
        )
      ) : (
        ADMIN_GROUPS.map((g) => {
          const tools = g.tools.filter(visible);
          if (!tools.length) return null;
          return (
            <section key={g.label}>
              <div className="mb-2">
                <h2 className="font-display text-lg">{g.label}</h2>
                <p className="text-sm text-muted-foreground">{g.blurb}</p>
              </div>
              <ToolGrid tools={tools} />
            </section>
          );
        })
      )}
    </div>
  );
}

function ToolGrid({ tools }: { tools: AdminTool[] }) {
  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {tools.map((t) => (
        <Link
          key={t.href} href={t.href}
          className="focus-ring group flex items-start gap-3 rounded-lg border bg-card p-3.5 shadow-sm transition-all hover:border-primary hover:shadow-md active:scale-[0.99]"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
            <t.icon className="h-4.5 w-4.5" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium">{t.title}</span>
            <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{t.desc}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}
