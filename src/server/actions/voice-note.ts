'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { getObjectStream } from '@/lib/storage/storage';
import { transcribeSiteNote, isGeminiEnabled, type VoiceNote } from '@/lib/ai/gemini';
import { nextReference } from '@/lib/utils/reference';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from './_helpers';

export type VoiceResult = { ok: true; draft: VoiceNote } | { error: string };

/** Fetch the uploaded audio and let Gemini transcribe + structure it. Nothing is saved yet. */
export async function processVoiceNote(url: string, mimeType: string): Promise<VoiceResult> {
  try {
    await ensure('task.create');
    if (!isGeminiEnabled()) return { error: 'Gemini API key is not configured (set GEMINI_API_KEY).' };
    if (!url) return { error: 'No recording provided.' };
    const { body } = await getObjectStream(url);
    if (body.length > 18 * 1024 * 1024) return { error: 'Recording is too long — keep it under about 10 minutes.' };
    const draft = await transcribeSiteNote(body, mimeType || 'audio/webm');
    if (!draft) return { error: 'Could not transcribe that recording. Try again in a quieter spot.' };
    return { ok: true, draft };
  } catch (err) { return toActionError(err); }
}

const saveSchema = z.object({
  kind: z.enum(['update', 'task']),
  title: z.string().min(2).max(160),
  description: z.string().max(4000).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  projectId: z.string().optional().nullable(),
  transcript: z.string().max(6000).optional(),
});

/** Turn the reviewed draft into a construction update or a task. */
export async function saveVoiceNote(input: unknown): Promise<{ ok: true; id: string; kind: string } | { error: string }> {
  try {
    const ctx = await ensure('task.create');
    const d = saveSchema.parse(input);
    const body = [d.description, d.transcript ? `\n--- Transcript ---\n${d.transcript}` : ''].filter(Boolean).join('');

    if (d.kind === 'update') {
      if (!d.projectId) return { error: 'Choose which project this site update belongs to.' };
      const u = await prisma.constructionUpdate.create({
        data: { projectId: d.projectId, title: d.title, body, milestone: null, createdById: ctx.user.id },
      });
      await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'ConstructionUpdate', entityId: u.id, summary: `Voice site update: ${d.title}` });
      revalidatePath('/customers');
      return { ok: true, id: u.id, kind: 'update' };
    }

    const reference = await nextReference('TSK');
    const t = await prisma.task.create({
      data: { reference, title: d.title, description: body, priority: d.priority, projectId: d.projectId || null, createdById: ctx.user.id },
    });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'Task', entityId: t.id, summary: `Voice task: ${d.title}` });
    revalidatePath('/tasks');
    return { ok: true, id: t.id, kind: 'task' };
  } catch (err) { return toActionError(err); }
}
