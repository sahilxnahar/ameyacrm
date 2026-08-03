'use client';
import * as React from 'react';
import Link from 'next/link';
import { Search, X, Sliders, RotateCcw, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { NAVIGATION } from '@/config/navigation';
import {
  TONES, GROUP_TONE, WEIGHT_SPAN, WEIGHT_HEIGHT, WEIGHT_LABEL, WEIGHT_ORDER,
  toneFor, weightFor, toneStyle, type ModuleTone, type Weight,
} from '@/config/module-style';
import { saveModuleStyle, resetModuleStyle } from '@/server/actions/nav-prefs';
import { cn } from '@/lib/utils/cn';

/**
 * The launchpad: everything the CRM can do, as a grid you scan rather than read.
 *
 * Two things do the work here.
 *
 * COLOUR. Each area of the business has a fixed colour — money is red, sales
 * green, site amber, land and legal indigo — and it is the same colour in the
 * menu, on this grid and under the page title once you arrive. With 122 screens,
 * reading every label every time is what makes software feel slow even when it
 * is fast. After a few days you stop reading and start aiming.
 *
 * SIZE. Equal tiles assert that all 122 features matter equally, which is false
 * and leaves the eye nowhere to land. Weight encodes how central something is to
 * a working day: Finance, Billing, Sales and Today's Priorities are large; the
 * capital-gains simulator and the UAN validator are small.
 *
 * Both are only defaults. Every tile's colour and size can be changed from the
 * Customise button and is stored against that person's account — because whose
 * day revolves around what differs by role, and the person doing the job knows
 * better than the default does.
 */
export function FeatureExplorer({
  allowed, isSuperAdmin, tones = {}, weights = {},
}: {
  allowed: string[];
  isSuperAdmin: boolean;
  tones?: Record<string, string>;
  weights?: Record<string, string>;
}) {
  const [query, setQuery] = React.useState('');
  const [editing, setEditing] = React.useState(false);
  const [tone, setTone] = React.useState<Record<string, ModuleTone>>(tones as Record<string, ModuleTone>);
  const [weight, setWeight] = React.useState<Record<string, Weight>>(weights as Record<string, Weight>);
  const [pending, start] = React.useTransition();
  // What the grid looked like when editing started, so Escape can put it back.
  const snapshot = React.useRef<{ t: Record<string, ModuleTone>; w: Record<string, Weight> } | null>(null);

  const cancelEditing = React.useCallback(() => {
    if (snapshot.current) { setTone(snapshot.current.t); setWeight(snapshot.current.w); }
    snapshot.current = null;
    setEditing(false);
  }, []);

  /*
   * Escape abandons the changes; it does not save them.
   *
   * Every other overlay in the app closes on Escape, so a person will press it
   * here too — and the surprising thing would be silently keeping half-finished
   * edits. Reverting to the snapshot means Escape always means "forget it",
   * which is what the key means everywhere else.
   */
  React.useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') cancelEditing(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing, cancelEditing]);

  const allowedSet = React.useMemo(() => new Set(allowed), [allowed]);
  const canSee = React.useCallback(
    (perm?: string) => !perm || isSuperAdmin || allowedSet.has(perm),
    [allowedSet, isSuperAdmin],
  );

  const q = query.trim().toLowerCase();
  const groups = React.useMemo(() => (
    NAVIGATION.map((g) => {
      const items = g.items.filter((i) => canSee(i.permission)).filter((i) => {
        if (!q) return true;
        return i.label.toLowerCase().includes(q)
          || (i.blurb ?? '').toLowerCase().includes(q)
          || g.label.toLowerCase().includes(q);
      });
      return { label: g.label, items };
    }).filter((g) => g.items.length > 0)
  ), [q, canSee]);

  const total = React.useMemo(
    () => NAVIGATION.reduce((n, g) => n + g.items.filter((i) => canSee(i.permission)).length, 0),
    [canSee],
  );

  const persist = () =>
    start(async () => {
      const r = await saveModuleStyle({ tones: tone, weights: weight });
      if ('error' in r) { toast.error(r.error); return; }
      toast.success('Saved — this is how it looks for you everywhere');
    });

  const reset = () =>
    start(async () => {
      const r = await resetModuleStyle();
      if ('error' in r) { toast.error(r.error); return; }
      setTone({}); setWeight({});
      toast.success('Back to the standard colours and sizes');
    });

  return (
    <div className="space-y-6">
      <div className="toolbar items-center gap-2">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${total} features…`}
            className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-9 text-sm focus:border-primary focus:outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} aria-label="Clear"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {editing && (
            <>
              <button type="button" onClick={reset} disabled={pending}
                className="focus-ring inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-2 text-sm">
                <RotateCcw className="h-4 w-4" /> Reset all
              </button>
              <button type="button" onClick={cancelEditing} disabled={pending}
                className="focus-ring inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-2 text-sm">
                <X className="h-4 w-4" /> Cancel
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => {
              if (editing) { persist(); snapshot.current = null; setEditing(false); return; }
              snapshot.current = { t: { ...tone }, w: { ...weight } };
              setEditing(true);
            }}
            disabled={pending}
            className={cn(
              'focus-ring inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium',
              editing ? 'bg-primary text-primary-foreground' : 'border border-input',
            )}
          >
            {pending
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
              : editing ? <><Check className="h-4 w-4" /> Save</> : <><Sliders className="h-4 w-4" /> Customise</>}
          </button>
        </div>
      </div>

      {editing && (
        <p className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
          Set any tile&rsquo;s colour and how much room it takes — <strong>the grid changes as you go</strong>,
          so what you see is what you get. This is yours alone; it changes nothing for anyone else.
          <span className="ml-1 text-muted-foreground">
            Press <kbd className="rounded border px-1 text-xs">Esc</kbd> to abandon the changes.
          </span>
        </p>
      )}

      {groups.map((g) => {
        const gs = toneStyle(GROUP_TONE[g.label] ?? 'day');
        return (
          <section key={g.label} className="space-y-3">
            <div className="flex items-center gap-2">
              <span className={cn('h-4 w-1 rounded-full', gs.dot)} />
              <h2 className="font-display text-lg font-semibold">{g.label}</h2>
              <span className="text-xs text-muted-foreground">{g.items.length}</span>
            </div>
            {/*
              A bento grid. Fixed-height rows plus a per-tile row span is what
              lets a hero tile be genuinely twice the height of a small one,
              rather than a stretched version of the same thing.
            */}
            <div className="grid auto-rows-[5.5rem] grid-flow-dense grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {g.items.map((item) => {
                const t = toneFor(g.label, item.href, tone);
                const w = weightFor(item.href, weight);
                const st = toneStyle(t);
                const Icon = item.icon;
                const big = w === 'hero' || w === 'large';
                const tiny = w === 'small';

                const body = (
                  <>
                    <span className={cn('absolute inset-x-0 top-0 h-0.5', st.dot)} />
                    {w === 'hero' && (
                      <span className={cn('pointer-events-none absolute inset-0 bg-gradient-to-br', st.wash)} />
                    )}
                    <span className="relative flex items-start gap-2.5">
                      <span className={cn('flex shrink-0 items-center justify-center rounded-lg',
                        st.bg, tiny ? 'h-7 w-7' : 'h-9 w-9')}>
                        <Icon className={cn(st.text, tiny ? 'h-3.5 w-3.5' : 'h-[18px] w-[18px]')} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cn('block font-semibold leading-tight [overflow-wrap:normal] [word-break:keep-all]',
                          w === 'hero' ? 'text-base' : tiny ? 'text-[13px]' : 'text-sm',
                          !big && 'line-clamp-2')}>
                          {item.label}
                        </span>
                        {big && item.blurb && (
                          <span className={cn('mt-1 block text-xs leading-snug text-muted-foreground',
                            w === 'hero' ? 'line-clamp-4' : 'line-clamp-2')}>
                            {item.blurb}
                          </span>
                        )}
                      </span>
                    </span>
                  </>
                );

                const shell = cn(
                  'group relative flex flex-col overflow-hidden rounded-xl border bg-card p-3 text-left transition-all',
                  'min-w-0',
                  WEIGHT_SPAN[w], WEIGHT_HEIGHT[w], st.border,
                  'hover:-translate-y-0.5 hover:shadow-md hover:ring-2', st.ring,
                );

                if (!editing) {
                  return <Link key={item.href} href={item.href} className={cn(shell, 'focus-ring')}>{body}</Link>;
                }
                return (
                  <div key={item.href} className={cn(shell, 'ring-2 ring-dashed', st.ring)}>
                    {body}
                    <div className="relative mt-auto space-y-1 pt-2">
                      <div className="flex flex-wrap gap-1">
                        {(Object.keys(TONES) as ModuleTone[]).map((k) => (
                          <button
                            key={k} type="button" title={TONES[k].label}
                            aria-label={`${item.label}: ${TONES[k].label}`}
                            onClick={() => setTone((p) => ({ ...p, [item.href]: k }))}
                            className={cn('h-3.5 w-3.5 rounded-full ring-offset-1 transition',
                              TONES[k].dot, t === k && 'ring-2 ring-foreground')}
                          />
                        ))}
                      </div>
                      <select
                        value={w}
                        onChange={(e) => setWeight((p) => ({ ...p, [item.href]: e.target.value as Weight }))}
                        aria-label={`${item.label}: size`}
                        className="h-6 w-full rounded border bg-background px-1 text-[11px]"
                      >
                        {WEIGHT_ORDER.map((k) => <option key={k} value={k}>{WEIGHT_LABEL[k]}</option>)}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {!groups.length && (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nothing matches &ldquo;{query}&rdquo;. Try another word.
        </p>
      )}
    </div>
  );
}
