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

    /*
     * Two round-trips, not two per lead. Enrolling the 500-lead maximum this
     * action allows used to mean up to a thousand sequential queries — a lookup
     * and an insert each — which is minutes of a held request, and the person
     * pressing the button sees a spinner the whole time.
     *
     * `skipDuplicates` leans on the sequenceId_leadId unique constraint, so the
     * race the read-then-write loop had is gone too: two admins enrolling the
     * same list at once previously both read "not enrolled" and both inserted.
     */
    const already = await prisma.sequenceEnrollment.findMany({
      where: { sequenceId, leadId: { in: leads.map((l) => l.id) } },
      select: { leadId: true },
    });
    const enrolled = new Set(already.map((e) => e.leadId));
    const fresh = leads.filter((l) => !enrolled.has(l.id));
    const nextStepAt = addDays(startOfDay(new Date()), seq.steps[0]?.dayOffset ?? 0);

    const created = fresh.length
      ? await prisma.sequenceEnrollment.createMany({
          data: fresh.map((l) => ({ sequenceId, leadId: l.id, enrolledById: ctx.user.id, nextStepAt })),
          skipDuplicates: true,
        })
      : { count: 0 };

    const added = created.count;
    // Anything skipDuplicates dropped was enrolled by someone else in between.
    const skipped = leads.length - added;

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
