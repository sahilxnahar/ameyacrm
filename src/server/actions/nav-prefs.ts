'use server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { ensure, toActionError } from '@/server/actions/_helpers';

export type NavResult = { ok: true } | { error: string };

/** Save one person's sidebar layout. Everything is by href, so renaming a page never breaks it. */
export async function saveNavPrefs(prefs: { pinned: string[]; order: string[]; hidden: string[] }): Promise<NavResult> {
  try {
    const ctx = await ensure('dashboard.view');
    const clean = {
      pinned: [...new Set(prefs.pinned)].filter((h) => h.startsWith('/')).slice(0, 12),
      order: [...new Set(prefs.order)].filter((h) => h.startsWith('/')).slice(0, 80),
      hidden: [...new Set(prefs.hidden)].filter((h) => h.startsWith('/')).slice(0, 80),
    };
    await prisma.user.update({ where: { id: ctx.user.id }, data: { navPrefs: clean } });
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

export async function resetNavPrefs(): Promise<NavResult> {
  try {
    const ctx = await ensure('dashboard.view');
    await prisma.user.update({ where: { id: ctx.user.id }, data: { navPrefs: undefined } });
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}
