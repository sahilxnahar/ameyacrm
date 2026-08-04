'use server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { ensure, toActionError } from '@/server/actions/_helpers';
import { can as hasPerm } from '@/lib/rbac/can';
import { readTopNavPrefs, isSafeHref, MAX_PINS, type NavPin, type TopNavPrefs } from '@/lib/nav/top-nav-prefs';

export type TopNavResult = { ok: true; prefs: TopNavPrefs } | { error: string };

/**
 * Save one person's top-navigation layout.
 *
 * Re-validated server-side even though the client already filtered: the payload
 * arrives from the browser, and an href that ends up in the site chrome is
 * exactly the kind of value worth checking twice.
 */
export async function saveTopNavPrefs(input: { hidden?: string[]; pins?: NavPin[]; order?: string[] }): Promise<TopNavResult> {
  try {
    const ctx = await ensure('dashboard.view');
    const clean = readTopNavPrefs({
      hidden: input.hidden ?? [],
      pins: (input.pins ?? []).slice(0, MAX_PINS),
      order: input.order ?? [],
    });
    await prisma.user.update({ where: { id: ctx.user.id }, data: { topNavPrefs: clean } });
    revalidatePath('/', 'layout');
    return { ok: true, prefs: clean };
  } catch (err) { return toActionError(err); }
}

export async function resetTopNavPrefs(): Promise<TopNavResult> {
  try {
    const ctx = await ensure('dashboard.view');
    await prisma.user.update({ where: { id: ctx.user.id }, data: { topNavPrefs: undefined } });
    revalidatePath('/', 'layout');
    return { ok: true, prefs: { hidden: [], pins: [], order: [] } };
  } catch (err) { return toActionError(err); }
}

export interface NavTarget { href: string; label: string; kind: NavPin['kind']; hint?: string }

/**
 * Things a user can pin: app screens, their Tally ledgers, and projects.
 *
 * Every result is permission-checked as it is gathered — the picker must never
 * offer a shortcut to something the person cannot open, or the pin becomes a
 * confusing dead end (and hints at data they are not meant to know exists).
 */
export async function searchNavTargets(query: string): Promise<{ ok: true; targets: NavTarget[] } | { error: string }> {
  try {
    const ctx = await ensure('dashboard.view');
    const q = String(query ?? '').trim().toLowerCase().slice(0, 60);
    const can = (p: string) => hasPerm(ctx.permissions, p as Parameters<typeof hasPerm>[1]);
    const out: NavTarget[] = [];

    const SCREENS: Array<{ href: string; label: string; perm?: string; hint?: string }> = [
      { href: '/today', label: 'Today', hint: 'Your daily priorities' },
      { href: '/sales', label: 'Sales & leads', perm: 'lead.view' },
      { href: '/inventory', label: 'Inventory', perm: 'unit.view' },
      { href: '/finance', label: 'Finance', perm: 'invoice.view' },
      { href: '/billing', label: 'Billing', perm: 'invoice.view' },
      { href: '/cash-book', label: 'Cash Book', perm: 'finance.ledger.view' },
      { href: '/ledger', label: 'Ledger', perm: 'finance.ledger.view' },
      { href: '/tally', label: 'Ameya Tally', perm: 'finance.ledger.view' },
      { href: '/tally/import', label: 'Tally Import', perm: 'finance.ledger.view' },
      { href: '/site-ops', label: 'Site Ops', perm: 'document.create' },
      { href: '/field', label: 'Site', perm: 'document.create' },
      { href: '/documents', label: 'Documents', perm: 'document.create' },
      { href: '/chat', label: 'Messages' },
      { href: '/assistant', label: 'Assistant' },
      { href: '/briefing', label: 'Daily Briefing' },
      { href: '/features', label: 'Explore Features' },
      { href: '/glossary', label: 'Glossary' },
      { href: '/admin', label: 'Admin', perm: 'admin.user.manage' },
    ];
    for (const s of SCREENS) {
      if (s.perm && !can(s.perm)) continue;
      if (q && !s.label.toLowerCase().includes(q)) continue;
      out.push({ href: s.href, label: s.label, kind: 'screen', hint: s.hint });
    }

    // Tally ledgers — only for people who may see the books.
    if (can('finance.ledger.view')) {
      const ledgers = await prisma.tallyLedger.findMany({
        where: q ? { name: { contains: q, mode: 'insensitive' } } : {},
        select: { id: true, name: true, group: true },
        orderBy: { name: 'asc' },
        take: 20,
      }).catch(() => []);
      for (const l of ledgers) {
        out.push({ href: `/tally?ledger=${encodeURIComponent(l.id)}`, label: l.name, kind: 'ledger', hint: l.group });
      }
    }

    // Projects.
    if (can('project.view') || can('unit.view')) {
      const projects = await prisma.project.findMany({
        where: q ? { name: { contains: q, mode: 'insensitive' } } : {},
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
        take: 15,
      }).catch(() => []);
      for (const p of projects) {
        out.push({ href: `/projects/${p.id}`, label: p.name, kind: 'project' });
      }
    }

    return { ok: true, targets: out.filter((t) => isSafeHref(t.href.split('?')[0]!)).slice(0, 60) };
  } catch (err) { return toActionError(err); }
}
