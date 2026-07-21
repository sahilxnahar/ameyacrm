'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from '@/server/actions/_helpers';
import { inferMimeType } from '@/lib/files/mime';

export type PhotoResult = { ok: true; count: number; folder: string; message: string } | { error: string };

const schema = z.object({
  projectId: z.string().optional().or(z.literal('')),
  caption: z.string().max(300).optional().or(z.literal('')),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  takenAt: z.string().optional().or(z.literal('')),
  photos: z.array(z.object({
    url: z.string().url(),
    name: z.string().min(1),
    size: z.number().int().nonnegative(),
    mimeType: z.string().optional().or(z.literal('')),
  })).min(1).max(20),
});

/**
 * File site photos without anyone choosing a folder.
 *
 * The folder is worked out from the project and the date — Site Photos /
 * <Project> / <Month Year> — because asking a person standing on a slab to
 * pick a folder is how photos end up in WhatsApp instead.
 */
export async function saveSitePhotos(input: unknown): Promise<PhotoResult> {
  try {
    const ctx = await ensure('document.create');
    const d = schema.parse(input);

    const project = d.projectId
      ? await prisma.project.findUnique({ where: { id: d.projectId }, select: { id: true, name: true } })
      : null;

    const taken = d.takenAt ? new Date(d.takenAt) : new Date();
    const monthName = taken.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

    const root = await folder('Site Photos', null, ctx.user.id);
    const projectFolder = await folder(project?.name ?? 'Unassigned', root, ctx.user.id, project?.id ?? null);
    const monthFolder = await folder(monthName, projectFolder, ctx.user.id, project?.id ?? null);

    const dateLabel = taken.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const place = d.latitude && d.longitude ? `${d.latitude.toFixed(5)}, ${d.longitude.toFixed(5)}` : null;

    let count = 0;
    for (const p of d.photos) {
      const fileObj = await prisma.fileObject.create({
        data: {
          key: p.url, bucket: 'blob', originalName: p.name,
          mimeType: inferMimeType(p.mimeType ?? '', p.name),
          size: p.size, uploadedById: ctx.user.id,
        },
      });
      const title = [d.caption?.trim() || 'Site photo', dateLabel].filter(Boolean).join(' — ');
      const doc = await prisma.document.create({
        data: {
          title: title.slice(0, 200),
          folderId: monthFolder,
          ownerId: ctx.user.id,
          currentVersion: 1,
          versions: { create: { version: 1, fileId: fileObj.id, createdById: ctx.user.id } },
        },
      });
      // Location and the moment it was taken, kept as searchable text.
      const note = [
        d.caption?.trim(),
        `Taken ${dateLabel}`,
        project?.name ? `at ${project.name}` : null,
        place ? `location ${place}` : null,
        `by ${ctx.user.name}`,
      ].filter(Boolean).join(' · ');
      await prisma.fileObject.update({ where: { id: fileObj.id }, data: { ocrText: note } }).catch(() => undefined);
      void doc;
      count++;
    }

    await writeAudit({
      actorId: ctx.user.id, action: 'CREATE', entityType: 'Document',
      summary: `${count} site photo${count === 1 ? '' : 's'} filed under ${project?.name ?? 'Unassigned'} / ${monthName}`,
    });
    revalidatePath('/site-photos');
    revalidatePath('/documents');

    return {
      ok: true, count, folder: `Site Photos / ${project?.name ?? 'Unassigned'} / ${monthName}`,
      message: `${count} photo${count === 1 ? '' : 's'} filed under ${project?.name ?? 'Unassigned'} / ${monthName}${place ? ', with the location' : ''}.`,
    };
  } catch (e) {
    return toActionError(e);
  }
}

/** Find or create one folder in the tree, by name under a parent. */
async function folder(name: string, parentId: string | null, userId: string, projectId: string | null = null): Promise<string> {
  const found = await prisma.folder.findFirst({
    where: { name, parentId, deletedAt: null },
    select: { id: true },
  });
  if (found) return found.id;
  const made = await prisma.folder.create({
    data: { name, parentId, projectId, createdById: userId, path: name, visibility: 'ORGANIZATION' },
    select: { id: true },
  });
  return made.id;
}
