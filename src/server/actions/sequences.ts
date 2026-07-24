'use server';
import { z } from 'zod';
import { addDays, startOfDay } from 'date-fns';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from '@/server/actions/_helpers';

export type SeqResult = { ok: true; message?: string; id?: string } | { error: string };

const seqSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(400).optional().or(z.literal('')),
  stopOnReply: z.boolean().default(true),
  stopOnStage: z.string().optional().or(z.literal('')),
});

export async function createSequence(input: unknown): Promise<SeqResult> {
  try {
    const ctx = await ensure('lead.update');
    const d = seqSchema.parse(input);
    const seq = await prisma.emailSequence.create({
      data: {
        name: d.name, description: d.description || null,
        stopOnReply: d.stopOnReply, stopOnStage: d.stopOnStage || null,
        createdById: ctx.user.id,
      },
    });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'Lead', entityId: seq.id, summary: `Created sequence ${d.name}` });
    revalidatePath('/sequences');
    return { ok: true, id: seq.id };
  } catch (err) { return toActionError(err); }
}

const stepSchema = z.object({
  sequenceId: z.string().min(1),
  dayOffset: z.coerce.number().min(0).max(180),
  subject: z.string().min(2).max(200),
  body: z.string().min(5).max(4000),
});

export async function addStep(input: unknown): Promise<SeqResult> {
  try {
    const ctx = await ensure('lead.update');
    const d = stepSchema.parse(input);
    const count = await prisma.sequenceStep.count({ where: { sequenceId: d.sequenceId } });
    await prisma.sequenceStep.create({
      data: { sequenceId: d.sequenceId, ordinal: count, dayOffset: d.dayOffset, subject: d.subject, body: d.body },
    });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'Lead', entityId: d.sequenceId, summary: 'Added a sequence step' });
    revalidatePath('/sequences');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

export async function deleteStep(id: string): Promise<SeqResult> {
  try {
    await ensure('lead.update');
    const step = await prisma.sequenceStep.findUnique({ where: { id }, select: { sequenceId: true } });
    if (!step) return { error: 'Step not found.' };
    await prisma.sequenceStep.delete({ where: { id } });
    // Close the gap so ordinals stay contiguous.
    const rest = await prisma.sequenceStep.findMany({ where: { sequenceId: step.sequenceId }, orderBy: { ordinal: 'asc' } });
    for (let i = 0; i < rest.length; i++) {
      const st = rest[i];
      if (st && st.ordinal !== i) await prisma.sequenceStep.update({ where: { id: st.id }, data: { ordinal: i } });
    }
    revalidatePath('/sequences');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

export async function setSequenceStatus(id: string, status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED'): Promise<SeqResult> {
  try {
    const ctx = await ensure('lead.update');
    const steps = await prisma.sequenceStep.count({ where: { sequenceId: id } });
    if (status === 'ACTIVE' && steps === 0) return { error: 'Add at least one step before switching it on.' };
    await prisma.emailSequence.update({ where: { id }, data: { status } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'Lead', entityId: id, summary: `Sequence ${status.toLowerCase()}` });
    revalidatePath('/sequences');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

/** Put leads into a sequence. Anyone without an email, or already enrolled, is skipped. */
export async function enrolLeads(sequenceId: string, leadIds: string[]): Promise<SeqResult> {
  try {
    const ctx = await ensure('lead.update');
    const seq = await prisma.emailSequence.findUnique({
      where: { id: sequenceId },
      include: { steps: { orderBy: { ordinal: 'asc' }, take: 1 } },
    });
    if (!seq) return { error: 'Sequence not found.' };
    if (!seq.steps.length) return { error: 'This sequence has no steps yet.' };

    const leads = await prisma.lead.findMany({
      where: { id: { in: leadIds.slice(0, 500) }, deletedAt: null, email: { not: null }, status: { notIn: ['WON', 'LOST'] } },
      select: { id: true },
    });

    let added = 0, skipped = 0;
    for (const l of leads) {
      const exists = await prisma.sequenceEnrollment.findUnique({
        where: { sequenceId_leadId: { sequenceId, leadId: l.id } }, select: { id: true },
      });
      if (exists) { skipped++; continue; }
      await prisma.sequenceEnrollment.create({
        data: {
          sequenceId, leadId: l.id, enrolledById: ctx.user.id,
          nextStepAt: addDays(startOfDay(new Date()), seq.steps[0]?.dayOffset ?? 0),
        },
      });
      added++;
    }

    const noEmail = leadIds.length - leads.length;
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'Lead', entityId: sequenceId, summary: `Enrolled ${added} leads` });
    revalidatePath('/sequences');
    return {
      ok: true,
      message: `${added} enrolled.` +
        (skipped ? ` ${skipped} already in it.` : '') +
        (noEmail > 0 ? ` ${noEmail} skipped — no email address or already closed.` : ''),
    };
  } catch (err) { return toActionError(err); }
}

export async function stopEnrollment(id: string): Promise<SeqResult> {
  try {
    await ensure('lead.update');
    await prisma.sequenceEnrollment.update({
      where: { id }, data: { status: 'STOPPED', endedAt: new Date(), endReason: 'Stopped by hand' },
    });
    revalidatePath('/sequences');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}
