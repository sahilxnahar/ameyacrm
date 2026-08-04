'use server';
import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { ensure, toActionError } from '@/server/actions/_helpers';

export type NavResult = { ok: true } | { error: string };

/** Save one person's sidebar layout. Everything is by href, so renaming a page never breaks it. */
export async function saveNavPrefs(prefs: { pinned: string[]; order: string[]; hidden: string[]; collapsed?: string[]; groups?: string[] }): Promise<NavResult> {
  try {
    const ctx = await ensure('dashboard.view');
    const clean = {
      pinned: [...new Set(prefs.pinned)].filter((h) => h.startsWith('/')).slice(0, 12),
      order: [...new Set(prefs.order)].filter((h) => h.startsWith('/')).slice(0, 80),
      hidden: [...new Set(prefs.hidden)].filter((h) => h.startsWith('/')).slice(0, 80),
      collapsed: [...new Set(prefs.collapsed ?? [])].filter((h) => typeof h === 'string' && h.length > 0).slice(0, 40),
      groups: [...new Set(prefs.groups ?? [])].filter((h) => typeof h === 'string' && h.length > 0).slice(0, 40),
    };
    await prisma.user.update({ where: { id: ctx.user.id }, data: { navPrefs: clean } });
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

/**
 * Persist just which groups are folded shut. Kept separate from `saveNavPrefs`
 * so folding a section is instant: the client already shows the change in local
 * state, so this only records it for next time and does not revalidate (which
 * would reload the whole layout and make a simple collapse feel heavy).
 */
export async function saveNavCollapsed(collapsed: string[]): Promise<NavResult> {
  try {
    const ctx = await ensure('dashboard.view');
    const current = readCollapsedMerge(await prisma.user.findUnique({ where: { id: ctx.user.id }, select: { navPrefs: true } }));
    const next = { ...current, collapsed: [...new Set(collapsed)].filter((h) => typeof h === 'string' && h.length > 0).slice(0, 40) };
    await prisma.user.update({ where: { id: ctx.user.id }, data: { navPrefs: next } });
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

/** Merge the stored prefs into a plain object so we never drop pinned/order/hidden when saving collapse. */
function readCollapsedMerge(row: { navPrefs: unknown } | null): { pinned: string[]; order: string[]; hidden: string[]; collapsed: string[]; groups: string[] } {
  const raw = (row?.navPrefs ?? {}) as Record<string, unknown>;
  const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  return { pinned: arr(raw.pinned), order: arr(raw.order), hidden: arr(raw.hidden), collapsed: arr(raw.collapsed), groups: arr(raw.groups) };
}

export async function resetNavPrefs(): Promise<NavResult> {
  try {
    const ctx = await ensure('dashboard.view');
    await prisma.user.update({ where: { id: ctx.user.id }, data: { navPrefs: undefined } });
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

/**
 * Save one person's colour and size choices for the launchpad.
 *
 * Kept separate from `saveNavPrefs` so that setting a tile's colour cannot
 * accidentally clobber a pinned list, and merged into the existing JSON rather
 * than replacing it. Everything is keyed by href, so renaming a page's title
 * never loses somebody's layout.
 */
export async function saveModuleStyle(input: {
  tones?: Record<string, string>;
  weights?: Record<string, string>;
}): Promise<NavResult> {
  try {
    const ctx = await ensure('dashboard.view');
    const TONES = ['money', 'sales', 'build', 'legal', 'people', 'documents', 'insight', 'marketing', 'admin', 'day'];
    const WEIGHTS = ['hero', 'large', 'medium', 'small'];

    const clean = (src: Record<string, string> | undefined, allowed: string[]) => {
      const out: Record<string, string> = {};
      for (const [href, v] of Object.entries(src ?? {})) {
        if (!href.startsWith('/') || !allowed.includes(v)) continue;
        out[href] = v;
        if (Object.keys(out).length >= 200) break;
      }
      return out;
    };

    const row = await prisma.user.findUnique({ where: { id: ctx.user.id }, select: { navPrefs: true } });
    const existing = (row?.navPrefs && typeof row.navPrefs === 'object' && !Array.isArray(row.navPrefs))
      ? (row.navPrefs as Record<string, unknown>)
      : {};

    await prisma.user.update({
      where: { id: ctx.user.id },
      data: {
        navPrefs: {
          ...existing,
          ...(input.tones ? { tones: clean(input.tones, TONES) } : {}),
          ...(input.weights ? { weights: clean(input.weights, WEIGHTS) } : {}),
        },
      },
    });
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (e) { return toActionError(e); }
}

/** Put every colour and size back to the standard. */
export async function resetModuleStyle(): Promise<NavResult> {
  try {
    const ctx = await ensure('dashboard.view');
    const row = await prisma.user.findUnique({ where: { id: ctx.user.id }, select: { navPrefs: true } });
    const existing = (row?.navPrefs && typeof row.navPrefs === 'object' && !Array.isArray(row.navPrefs))
      ? (row.navPrefs as Record<string, unknown>) : {};
    delete existing.tones; delete existing.weights;
    await prisma.user.update({ where: { id: ctx.user.id }, data: { navPrefs: existing as Prisma.InputJsonValue } });
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (e) { return toActionError(e); }
}
