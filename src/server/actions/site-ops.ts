'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from '@/server/actions/_helpers';

export type SiteLogResult = { ok: true; id: string; photoCount: number } | { error: string };

const photoSchema = z.object({
  url: z.string().url(),
  milestoneTag: z.string().min(1).max(60),
  capturedAt: z.string().optional().or(z.literal('')),
});

const schema = z.object({
  projectId: z.string().min(1, 'Pick a project.'),
  date: z.string().min(1),
  weather: z.string().min(1).max(40),
  laborCount: z.number().int().min(0).max(100000),
  notes: z.string().max(5000).optional().or(z.literal('')),
  photos: z.array(photoSchema).max(30).optional().default([]),
});

/**
 * Record one day's site log for a project, with any photos attached in the same
 * write. Photos are created as nested SitePhoto rows so a log and its images are
 * always consistent. Field engineers hold `document.create` already, so no new
 * permission key is introduced.
 */
export async function saveDailySiteLog(input: unknown): Promise<SiteLogResult> {
  try {
    const ctx = await ensure('document.create');
    const d = schema.parse(input);

    const project = await prisma.project.findUnique({ where: { id: d.projectId }, select: { id: true, name: true } });
    if (!project) return { error: 'That project no longer exists.' };

    const logDate = new Date(d.date);
    if (Number.isNaN(logDate.getTime())) return { error: 'Enter a valid date.' };

    const log = await prisma.dailySiteLog.create({
      data: {
        date: logDate,
        weather: d.weather,
        laborCount: d.laborCount,
        notes: d.notes?.trim() || null,
        projectId: project.id,
        authorId: ctx.user.id,
        photos: {
          create: d.photos.map((p) => ({
            url: p.url,
            milestoneTag: p.milestoneTag,
            capturedAt: p.capturedAt ? new Date(p.capturedAt) : new Date(),
          })),
        },
      },
      select: { id: true, _count: { select: { photos: true } } },
    });

    await writeAudit({
      actorId: ctx.user.id,
      action: 'CREATE',
      entityType: 'DailySiteLog',
      entityId: log.id,
      summary: `Site log for ${project.name} — ${d.laborCount} on site, ${log._count.photos} photo${log._count.photos === 1 ? '' : 's'}`,
    });

    revalidatePath('/site-ops');
    return { ok: true, id: log.id, photoCount: log._count.photos };
  } catch (e) {
    return toActionError(e);
  }
}
