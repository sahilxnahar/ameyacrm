'use server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from '@/server/actions/_helpers';

export type ProjectResult = { ok: true; id?: string } | { error: string };

function slugCode(name: string): string {
  const letters = name.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 4) || 'PROJ';
  return `${letters}-01`;
}

/**
 * Create a new project. Anyone with admin.project.manage (Super Admin / Owner)
 * can add one. Only the name is required — a code is generated if none is given,
 * and everything else is optional so a project can be spun up in seconds and
 * filled in later.
 */
export async function createProject(input: {
  name: string;
  code?: string;
  city?: string;
  address?: string;
  reraNumber?: string;
  description?: string;
}): Promise<ProjectResult> {
  try {
    const ctx = await ensure('admin.project.manage');
    const name = input.name.trim();
    if (!name) return { error: 'Give the project a name.' };

    let code = (input.code ?? '').trim().toUpperCase();
    if (!code) code = slugCode(name);

    // Codes must be unique — nudge to a free one rather than failing on a clash.
    const clash = await prisma.project.findUnique({ where: { code }, select: { id: true } });
    if (clash) {
      let n = 2;
      const base = code.replace(/-\d+$/, '');
      while (await prisma.project.findUnique({ where: { code: `${base}-${String(n).padStart(2, '0')}` }, select: { id: true } })) n++;
      code = `${base}-${String(n).padStart(2, '0')}`;
    }

    const project = await prisma.project.create({
      data: {
        name,
        code,
        city: input.city?.trim() || 'Bangalore',
        address: input.address?.trim() || null,
        reraNumber: input.reraNumber?.trim() || null,
        description: input.description?.trim() || null,
      },
      select: { id: true, name: true },
    });

    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'Project', entityId: project.id, summary: `Created project ${project.name} (${code})` });
    revalidatePath('/admin/projects');
    revalidatePath('/', 'layout');
    return { ok: true, id: project.id };
  } catch (err) { return toActionError(err); }
}

/** Rename / edit the core details of a project. */
export async function updateProject(id: string, input: {
  name?: string;
  city?: string;
  address?: string;
  reraNumber?: string;
  description?: string;
}): Promise<ProjectResult> {
  try {
    const ctx = await ensure('admin.project.manage');
    const project = await prisma.project.findUnique({ where: { id }, select: { id: true } });
    if (!project) return { error: 'That project no longer exists.' };

    await prisma.project.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.city !== undefined ? { city: input.city.trim() || 'Bangalore' } : {}),
        ...(input.address !== undefined ? { address: input.address.trim() || null } : {}),
        ...(input.reraNumber !== undefined ? { reraNumber: input.reraNumber.trim() || null } : {}),
        ...(input.description !== undefined ? { description: input.description.trim() || null } : {}),
      },
    });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'Project', entityId: id, summary: `Updated project details` });
    revalidatePath('/admin/projects');
    revalidatePath('/', 'layout');
    return { ok: true, id };
  } catch (err) { return toActionError(err); }
}

/** Archive or re-activate a project. Archived projects drop out of the switcher. */
export async function setProjectActive(id: string, isActive: boolean): Promise<ProjectResult> {
  try {
    const ctx = await ensure('admin.project.manage');
    const project = await prisma.project.findUnique({ where: { id }, select: { id: true, name: true } });
    if (!project) return { error: 'That project no longer exists.' };
    await prisma.project.update({ where: { id }, data: { isActive } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'Project', entityId: id, summary: `${isActive ? 'Re-activated' : 'Archived'} project ${project.name}` });
    revalidatePath('/admin/projects');
    revalidatePath('/', 'layout');
    return { ok: true, id };
  } catch (err) { return toActionError(err); }
}
