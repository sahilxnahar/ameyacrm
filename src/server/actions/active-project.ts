'use server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { ensure, toActionError } from '@/server/actions/_helpers';

export type ProjResult = { ok: true } | { error: string };

/** Switch the project this person is working on. Empty string means all projects. */
export async function setActiveProject(projectId: string): Promise<ProjResult> {
  try {
    const ctx = await ensure('dashboard.view');
    const id = projectId.trim() || null;
    if (id) {
      const exists = await prisma.project.findFirst({ where: { id, isActive: true }, select: { id: true } });
      if (!exists) return { error: 'That project no longer exists.' };
    }
    await prisma.user.update({ where: { id: ctx.user.id }, data: { activeProjectId: id } });
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}
