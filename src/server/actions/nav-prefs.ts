'use server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { ensure, toActionError } from '@/server/actions/_helpers';

export type NavResult = { ok: true } | { error: string };

/** Save one person's sidebar layout. Everything is by href, so renaming a page never breaks it. */
export async function saveNavPrefs(prefs: { pinned: string[]; order: string[]; hidden: string[]; collapsed?: string[] }): Promise<NavResult> {
  try {
    const ctx = await ensure('dashboard.view');
    const clean = {
      pinned: [...new Set(prefs.pinned)].filter((h) => h.startsWith('/')).slice(0, 12),
      order: [...new Set(prefs.order)].filter((h) => h.startsWith('/')).slice(0, 80),
      hidden: [...new Set(prefs.hidden)].filter((h) => h.startsWith('/')).slice(0, 80),
      collapsed: [...new Set(prefs.collapsed ?? [])].filter((h) => typeof h === 'string' && h.length > 0).slice(0, 40),
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
function readCollapsedMerge(row: { navPrefs: unknown } | null): { pinned: string[]; order: string[]; hidden: string[]; collapsed: string[] } {
  const raw = (row?.navPrefs ?? {}) as Record<string, unknown>;
  const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  return { pinned: arr(raw.pinned), order: arr(raw.order), hidden: arr(raw.hidden), collapsed: arr(raw.collapsed) };
}

export async function resetNavPrefs(): Promise<NavResult> {
  try {
    const ctx = await ensure('dashboard.view');
    await prisma.user.update({ where: { id: ctx.user.id }, data: { navPrefs: undefined } });
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}
