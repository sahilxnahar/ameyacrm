'use server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from '@/server/actions/_helpers';
import { DEPARTMENT_CATALOGUE } from '@/config/departments';

export type DeptResult = { ok: true; created?: number; skipped?: number } | { error: string };

/**
 * Create the chosen departments from the catalogue. Idempotent: anything that
 * already exists (matched on slug) is left exactly as it is, so running this
 * twice never duplicates or overwrites a department you have edited.
 */
export async function importDepartments(slugs: string[]): Promise<DeptResult> {
  try {
    const ctx = await ensure('admin.department.manage');
    const wanted = new Set(slugs);
    if (!wanted.size) return { error: 'Pick at least one department.' };

    let created = 0;
    let skipped = 0;

    for (const division of DEPARTMENT_CATALOGUE) {
      const childrenWanted = division.children.filter((c) => wanted.has(c.slug));
      const needDivision = wanted.has(division.slug) || childrenWanted.length > 0;
      if (!needDivision) continue;

      // A team cannot exist without its division, so create the parent regardless.
      let parent = await prisma.department.findUnique({ where: { slug: division.slug } });
      if (parent) {
        skipped++;
      } else {
        parent = await prisma.department.create({
          data: { slug: division.slug, name: division.name, description: division.description, color: division.color },
        });
        created++;
      }

      for (const child of childrenWanted) {
        const existing = await prisma.department.findUnique({ where: { slug: child.slug } });
        if (existing) { skipped++; continue; }
        await prisma.department.create({
          data: { slug: child.slug, name: child.name, description: child.description, color: division.color, parentId: parent.id },
        });
        created++;
      }
    }

    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'Department', summary: `Imported ${created} departments from the catalogue` });
    revalidatePath('/admin/departments');
    revalidatePath('/admin');
    return { ok: true, created, skipped };
  } catch (err) { return toActionError(err); }
}

/** Assign the person who runs a department. Drives hierarchy-based work routing. */
export async function setDepartmentHead(departmentId: string, headId: string | null): Promise<DeptResult> {
  try {
    const ctx = await ensure('admin.department.manage');
    const dept = await prisma.department.update({ where: { id: departmentId }, data: { headId }, select: { name: true } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'Department', entityId: departmentId, summary: headId ? `Set head of ${dept.name}` : `Cleared head of ${dept.name}` });
    revalidatePath('/admin/departments');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

/** Move a team under a different division (or make it a division in its own right). */
export async function setDepartmentParent(departmentId: string, parentId: string | null): Promise<DeptResult> {
  try {
    const ctx = await ensure('admin.department.manage');
    if (parentId === departmentId) return { error: 'A department cannot sit inside itself.' };
    if (parentId) {
      let cur: string | null = parentId;
      for (let i = 0; i < 10 && cur; i++) {
        if (cur === departmentId) return { error: 'That would create a loop.' };
        const up: { parentId: string | null } | null = await prisma.department.findUnique({ where: { id: cur }, select: { parentId: true } });
        cur = up?.parentId ?? null;
      }
    }
    await prisma.department.update({ where: { id: departmentId }, data: { parentId } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'Department', entityId: departmentId, summary: 'Moved department' });
    revalidatePath('/admin/departments');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

/**
 * Hide a department without deleting it. Safer than deletion — people, tasks
 * and material requests stay attached and nothing orphans.
 */
export async function setDepartmentActive(departmentId: string, isActive: boolean): Promise<DeptResult> {
  try {
    const ctx = await ensure('admin.department.manage');
    const dept = await prisma.department.update({ where: { id: departmentId }, data: { isActive }, select: { name: true } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'Department', entityId: departmentId, summary: `${isActive ? 'Activated' : 'Deactivated'} ${dept.name}` });
    revalidatePath('/admin/departments');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}
