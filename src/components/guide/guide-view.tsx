'use client';
import * as React from 'react';
import Link from 'next/link';
import { Search, X, Rocket, Sliders, Command, LifeBuoy } from 'lucide-react';
import { NAVIGATION } from '@/config/navigation';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';

/** First things a new person should do, in order. */
const GETTING_STARTED: { title: string; body: string }[] = [
  { title: '1. Check your profile', body: 'Top-right avatar → Settings. Confirm your name, set a photo, and change your password (minimum 8 characters).' },
  { title: '2. Set a comfortable view', body: 'Top bar → the sliders icon → “Quick view”. Tap “Easy view” for roomy spacing and larger text, or fine-tune Spacing and Text size yourself. It’s remembered on your device.' },
  { title: '3. Make the menu yours', body: 'In the left menu, use “Customise this menu” to pin the screens you use daily to the top and hide the ones you don’t. Or collapse the whole menu to a slim icon rail.' },
  { title: '4. Learn one shortcut', body: 'Press ⌘K (Ctrl+K on Windows) anywhere to jump to any screen or search any lead, task, buyer or file — the fastest way to move around.' },
  { title: '5. Find your work', body: 'Start each day on “Today’s Priorities” and the Home dashboard — everything due, plus your key numbers, in one place.' },
];

/** Everyday personalisation and power tips, so the app fits each person. */
const PERSONALISE: { title: string; body: string }[] = [
  { title: 'Light or dark', body: 'The sun/moon icon in the top bar switches between light and dark. Pick an accent colour too (Display menu → Accent).' },
  { title: 'Minimise Home sections', body: 'On the Home dashboard, click any section heading (At a glance, Needs attention, Tasks & files) to fold it away. Remembered for you.' },
  { title: 'Notifications', body: 'The bell (top bar) shows what needs you; “Notifications” in the menu is the full inbox — filter, deep-link and mark read. Set what you want under Settings → Notifications.' },
  { title: 'The AI Assistant', body: 'On the right of your Home page (and under Assistant): draft a message, explain a term, or summarise something you paste.' },
  { title: 'Upload anything', body: 'In Documents, drag & drop any file (PDF, image, CAD, Office, ZIP) — or paste a screenshot straight in.' },
];

/** One friendly line per department, so people know what each area is for. */
const GROUP_INTROS: Record<string, string> = {
  'My Day': 'Your daily cockpit — open these every morning: what’s due, your dashboard, messages and approvals.',
  'Sales & Leads': 'Every enquiry from first contact to booking — capture, follow up, and never lose a lead.',
  'Inventory & Bookings': 'What you have to sell and what you’ve sold — units, prices, floor plans and buyers.',
  'Marketing': 'Campaigns, the website and the social handles that bring enquiries in.',
  'Money': 'Everything financial — bills, collections, payments, ledgers and the books.',
  'Build & Site': 'Construction and site work — materials, drawings, safety, live readings and progress.',
  'Land, Lease & Legal': 'Ownership, tenancies and the statutory duties you must not miss.',
  'Documents': 'Every file in one place — upload, organise, and even ask questions of your documents.',
  'Insights & Reports': 'Turn the data into answers — ready-made reports, your own reports, and forecasts.',
  'Team & Admin': 'Your people and the settings that run the system — roles, health, help and this guide.',
};

export function GuideView({ allowed, isSuperAdmin }: { allowed: string[]; isSuperAdmin: boolean }) {
  const [q, setQ] = React.useState('');
  const allowedSet = React.useMemo(() => new Set(allowed), [allowed]);
  const canSee = React.useCallback((perm?: string) => !perm || isSuperAdmin || allowedSet.has(perm), [allowedSet, isSuperAdmin]);
  const term = q.trim().toLowerCase();

  const groups = React.useMemo(() =>
    NAVIGATION.map((g) => ({
      label: g.label,
      intro: GROUP_INTROS[g.label] ?? g.blurb ?? '',
      items: g.items.filter((i) => canSee(i.permission)).filter((i) =>
        !term || i.label.toLowerCase().includes(term) || (i.blurb ?? '').toLowerCase().includes(term) || g.label.toLowerCase().includes(term)),
    })).filter((g) => g.items.length > 0),
  [term, canSee]);

  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  return (
    <div className="space-y-6">
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the guide…" autoFocus
          className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-9 text-sm focus:border-primary focus:outline-none" />
        {q && <button onClick={() => setQ('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-secondary" aria-label="Clear"><X className="h-4 w-4" /></button>}
      </div>

      {!term && (
        <>
          {/* Contents */}
          <Card className="p-4 sm:p-5">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">In this guide</p>
            <div className="flex flex-wrap gap-2 text-sm">
              <a href="#getting-started" className="rounded-full border px-3 py-1 hover:bg-secondary">Getting started</a>
              <a href="#personalise" className="rounded-full border px-3 py-1 hover:bg-secondary">Make it yours</a>
              {groups.map((g) => <a key={g.label} href={`#${slug(g.label)}`} className="rounded-full border px-3 py-1 hover:bg-secondary">{g.label}</a>)}
              <a href="#help" className="rounded-full border px-3 py-1 hover:bg-secondary">Getting help</a>
            </div>
          </Card>

          <section id="getting-started" className="scroll-mt-20">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold"><Rocket className="h-5 w-5 text-primary" /> Getting started — your first 5 minutes</h2>
            <div className="space-y-3">
              {GETTING_STARTED.map((s) => (
                <Card key={s.title} className="p-3.5"><p className="text-sm font-semibold">{s.title}</p><p className="mt-0.5 text-sm text-muted-foreground">{s.body}</p></Card>
              ))}
            </div>
          </section>

          <section id="personalise" className="scroll-mt-20">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold"><Sliders className="h-5 w-5 text-primary" /> Make it yours</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {PERSONALISE.map((s) => (
                <Card key={s.title} className="p-3.5"><p className="text-sm font-semibold">{s.title}</p><p className="mt-0.5 text-sm text-muted-foreground">{s.body}</p></Card>
              ))}
            </div>
          </section>
        </>
      )}

      {/* Department-by-department — every feature you can open, and what it's for. */}
      {groups.map((g) => (
        <section key={g.label} id={slug(g.label)} className="scroll-mt-20">
          <h2 className="text-lg font-semibold">{g.label}</h2>
          {g.intro && <p className="mb-3 mt-0.5 text-sm text-muted-foreground">{g.intro}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            {g.items.map((i) => {
              const Icon = i.icon;
              return (
                <Link key={i.href} href={i.href}>
                  <Card className="flex h-full items-start gap-3 p-3.5 transition-colors hover:border-primary hover:bg-secondary/40">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span>
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
      ))}

      {!term && (
        <section id="help" className="scroll-mt-20">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold"><LifeBuoy className="h-5 w-5 text-primary" /> Getting help</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <Link href="/glossary"><Card className="p-3.5 hover:border-primary"><p className="text-sm font-semibold">Glossary</p><p className="text-xs text-muted-foreground">Plain-English meaning of any term.</p></Card></Link>
            <Link href="/features"><Card className="p-3.5 hover:border-primary"><p className="text-sm font-semibold">Explore Features</p><p className="text-xs text-muted-foreground">A searchable map of every screen.</p></Card></Link>
            <Link href="/updates"><Card className="p-3.5 hover:border-primary"><p className="text-sm font-semibold">What’s New</p><p className="text-xs text-muted-foreground">Everything we’ve added, newest first.</p></Card></Link>
          </div>
        </section>
      )}

      {term && groups.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Nothing in the guide matches “{q}”.</p>}
    </div>
  );
}
