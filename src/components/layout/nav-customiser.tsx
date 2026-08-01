'use client';

import * as React from 'react';
import { toast } from 'sonner';
import {
  Settings2, X, Search, Plus, Trash2, ArrowUp, ArrowDown, RotateCcw,
  BookOpen, Building2, LayoutGrid, FileBarChart,
} from 'lucide-react';
import { saveTopNavPrefs, resetTopNavPrefs, searchNavTargets, type NavTarget } from '@/server/actions/top-nav';
import { MAX_PINS, type NavPin, type TopNavPrefs } from '@/lib/nav/top-nav-prefs';

/**
 * Lets a person arrange their own top navigation: switch default modules off,
 * and pin anything they open often — a ledger, a project, any screen.
 *
 * Reordering uses explicit up/down buttons rather than drag-and-drop. Dragging
 * is fiddly on a trackpad, impossible from a keyboard, and this row is small
 * enough that two buttons are simply faster.
 */

const KIND_ICON = { ledger: BookOpen, project: Building2, screen: LayoutGrid, report: FileBarChart } as const;

interface Props {
  prefs: TopNavPrefs;
  /** The built-in modules, so they can be switched off. */
  defaults: Array<{ href: string; label: string }>;
}

export function NavCustomiser({ prefs, defaults }: Props) {
  const [open, setOpen] = React.useState(false);
  const [hidden, setHidden] = React.useState<string[]>(prefs.hidden);
  const [pins, setPins] = React.useState<NavPin[]>(prefs.pins);
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<NavTarget[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [pending, start] = React.useTransition();

  // Reset local state whenever the dialog opens, so an abandoned edit does not
  // reappear the next time it is opened.
  React.useEffect(() => {
    if (open) { setHidden(prefs.hidden); setPins(prefs.pins); setQuery(''); }
  }, [open, prefs]);

  // Debounced search — one request after typing settles, not one per keystroke.
  React.useEffect(() => {
    if (!open) return;
    setSearching(true);
    const t = window.setTimeout(async () => {
      const r = await searchNavTargets(query);
      setResults('ok' in r ? r.targets : []);
      setSearching(false);
    }, 220);
    return () => { window.clearTimeout(t); };
  }, [query, open]);

  const isPinned = (href: string) => pins.some((p) => p.href === href);

  const addPin = (t: NavTarget) => {
    if (isPinned(t.href)) return;
    if (pins.length >= MAX_PINS) { toast.error(`That is the limit of ${MAX_PINS} pins.`); return; }
    setPins((p) => [...p, { href: t.href, label: t.label, kind: t.kind }]);
  };
  const removePin = (href: string) => setPins((p) => p.filter((x) => x.href !== href));
  const move = (i: number, dir: -1 | 1) => {
    setPins((p) => {
      const j = i + dir;
      if (j < 0 || j >= p.length) return p;
      const next = [...p];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
  };

  const save = () => start(async () => {
    const r = await saveTopNavPrefs({ hidden, pins, order: [] });
    if ('error' in r) { toast.error(r.error); return; }
    toast.success('Menu updated');
    setOpen(false);
  });

  const reset = () => start(async () => {
    const r = await resetTopNavPrefs();
    if ('error' in r) { toast.error(r.error); return; }
    setHidden([]); setPins([]);
    toast.success('Menu put back to the default');
    setOpen(false);
  });

  return (
    <>
      <button
        type="button"
        data-tour="nav-customise"
        onClick={() => setOpen(true)}
        title="Customise this menu — pin what you use most"
        aria-label="Customise the navigation menu"
        className="focus-ring inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
      >
        <Settings2 className="h-3.5 w-3.5 shrink-0" />
        <span className="whitespace-nowrap">Customise</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-modal flex items-start justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="Customise navigation">
          <div className="card-elevated max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-background p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-lg">Customise your menu</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Switch off what you never use, and pin the things you open every day.
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="focus-ring rounded p-1 text-muted-foreground hover:bg-secondary">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Default modules on/off */}
            <section className="mt-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Built-in modules</h3>
              <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                {defaults.map((d) => {
                  const off = hidden.includes(d.href);
                  return (
                    <label key={d.href} className="flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm hover:bg-secondary/50">
                      <input
                        type="checkbox" checked={!off}
                        onChange={(e) => setHidden((h) => e.target.checked ? h.filter((x) => x !== d.href) : [...h, d.href])}
                        className="h-4 w-4"
                      />
                      <span className={off ? 'text-muted-foreground line-through' : ''}>{d.label}</span>
                    </label>
                  );
                })}
              </div>
            </section>

            {/* Current pins */}
            <section className="mt-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Your pins {pins.length > 0 && <span className="font-normal normal-case">({pins.length} of {MAX_PINS})</span>}
              </h3>
              {pins.length === 0 ? (
                <p className="mt-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                  Nothing pinned yet. Search below to add a ledger, a project or any screen.
                </p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {pins.map((p, i) => {
                    const Icon = KIND_ICON[p.kind] ?? LayoutGrid;
                    return (
                      <li key={p.href} className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm">
                        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="flex-1 truncate">{p.label}</span>
                        <span className="hidden text-[11px] text-muted-foreground sm:inline">{p.kind}</span>
                        <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${p.label} up`} className="focus-ring rounded p-1 hover:bg-secondary disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                        <button type="button" onClick={() => move(i, 1)} disabled={i === pins.length - 1} aria-label={`Move ${p.label} down`} className="focus-ring rounded p-1 hover:bg-secondary disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
                        <button type="button" onClick={() => removePin(p.href)} aria-label={`Remove ${p.label}`} className="focus-ring rounded p-1 text-muted-foreground hover:bg-secondary hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* Add a pin */}
            <section className="mt-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Add a pin</h3>
              <div className="relative mt-2">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query} onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search screens, ledgers and projects…"
                  className="w-full rounded-md border bg-background py-2 pl-8 pr-3 text-sm"
                />
              </div>
              <div className="mt-2 max-h-56 overflow-y-auto rounded-md border">
                {searching && <p className="p-3 text-sm text-muted-foreground">Searching…</p>}
                {!searching && results.length === 0 && <p className="p-3 text-sm text-muted-foreground">Nothing matched.</p>}
                {!searching && results.map((t) => {
                  const Icon = KIND_ICON[t.kind] ?? LayoutGrid;
                  const already = isPinned(t.href);
                  return (
                    <button
                      key={`${t.kind}:${t.href}`} type="button" onClick={() => addPin(t)} disabled={already}
                      className="flex w-full items-center gap-2 border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-secondary/50 disabled:opacity-45"
                    >
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="flex-1 truncate">
                        {t.label}
                        {t.hint && <span className="ml-1.5 text-xs text-muted-foreground">{t.hint}</span>}
                      </span>
                      {already ? <span className="text-[11px] text-muted-foreground">pinned</span> : <Plus className="h-3.5 w-3.5 text-primary" />}
                    </button>
                  );
                })}
              </div>
            </section>

            <div className="mt-6 flex items-center justify-between gap-2">
              <button type="button" onClick={reset} disabled={pending} className="focus-ring inline-flex items-center gap-1.5 text-sm text-muted-foreground underline hover:text-foreground disabled:opacity-50">
                <RotateCcw className="h-3.5 w-3.5" /> Reset to default
              </button>
              <div className="flex gap-2">
                <button type="button" onClick={() => setOpen(false)} className="focus-ring rounded-md border px-4 py-1.5 text-sm">Cancel</button>
                <button type="button" onClick={save} disabled={pending} className="focus-ring rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50">
                  {pending ? 'Saving…' : 'Save menu'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
