'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from '@/server/actions/_helpers';

export type SiteLogResult =
  | { ok: true; id: string; photoCount: number; progressNote?: string | null; sharedWithBuyers?: boolean }
  | { error: string };

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
  /** Optional: which programme activity today's work moved, and how far along it now is. */
  activityId: z.string().optional().or(z.literal('')),
  percentComplete: z.number().min(0).max(100).optional(),
  /** Optional: push today's milestone photo to the buyer portal as a progress update. */
  shareWithBuyers: z.boolean().optional().default(false),
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

    let progressNote: string | null = null;
    let sharedWithBuyers = false;

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

    // ── Consumers ───────────────────────────────────────────────────────────
    //
    // The site log used to be a write-only diary: engineers filled it in every
    // day and nothing downstream ever read it, so the programme was updated by
    // hand from the same information and buyers were told about progress by
    // WhatsApp. Both of those now happen from this one entry. Neither can fail
    // the log — the diary is the record, these are consequences of it.

    // 1. Programme progress. Recording the percentage against the activity is
    //    what turns a diary into a schedule, and it back-fills actualStart /
    //    actualEnd so the delay reports have something real to compare against.
    if (d.activityId && d.percentComplete !== undefined) {
      try {
        const activity = await prisma.programmeActivity.findFirst({
          where: { id: d.activityId, projectId: project.id },
          select: { id: true, name: true, actualStart: true, percentComplete: true },
        });
        if (activity) {
          const pct = Math.round(d.percentComplete * 100) / 100;
          await prisma.progressUpdate.create({
            data: {
              activityId: activity.id, updateDate: logDate, percentComplete: pct,
              note: d.notes?.trim()?.slice(0, 500) || `Site log ${logDate.toLocaleDateString('en-IN')}`,
              recordedById: ctx.user.id,
            },
          });
          await prisma.programmeActivity.update({
            where: { id: activity.id },
            data: {
              percentComplete: pct,
              // First reported progress starts the clock; 100% stops it. Both are
              // only set once, so a later correction cannot rewrite the dates.
              actualStart: activity.actualStart ?? (pct > 0 ? logDate : null),
              actualEnd: pct >= 100 ? logDate : null,
            },
          });
          progressNote = `${activity.name} → ${pct}%`;
        }
      } catch { /* the log stands */ }
    }

    // 2. The buyer portal. A milestone photo taken today IS the progress update
    //    buyers are asking for; re-typing it into a second screen is why the
    //    portal went stale.
    if (d.shareWithBuyers && d.photos.length > 0) {
      try {
        const lead = d.photos[0];
        if (!lead) throw new Error('no photo');
        const tag = lead.milestoneTag;
        await prisma.constructionUpdate.create({
          data: {
            projectId: project.id,
            title: `${tag} — ${logDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`,
            body: d.notes?.trim()?.slice(0, 1000) || null,
            milestone: tag,
            imageUrl: lead.url,
            createdById: ctx.user.id,
          },
        });
        sharedWithBuyers = true;
      } catch { /* the log stands */ }
    }

    revalidatePath('/site-ops');
    revalidatePath('/programme');
    if (sharedWithBuyers) revalidatePath('/customers');
    return { ok: true, id: log.id, photoCount: log._count.photos, progressNote, sharedWithBuyers };
  } catch (e) {
    return toActionError(e);
  }
}
