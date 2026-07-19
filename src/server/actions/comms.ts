'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { sendEmail } from '@/lib/email/email';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from './_helpers';

export type CommResult = { ok: true } | { error: string };

const mailSchema = z.object({ leadId: z.string().min(1), subject: z.string().min(2).max(200), body: z.string().min(2).max(5000) });

/** Send an email to a lead and log it on the timeline. */
export async function sendLeadEmail(input: unknown): Promise<CommResult> {
  try {
    const ctx = await ensure('lead.update');
    const d = mailSchema.parse(input);
    const lead = await prisma.lead.findUnique({ where: { id: d.leadId }, select: { id: true, name: true, email: true } });
    if (!lead) return { error: 'Lead not found.' };
    if (!lead.email) return { error: 'This lead has no email address.' };
    const res = await sendEmail({ to: [lead.email], subject: d.subject, text: d.body });
    if (!res.ok) return { error: `Could not send: ${res.error ?? 'email provider not configured'}` };
    await prisma.leadActivity.create({ data: { leadId: lead.id, userId: ctx.user.id, type: 'EMAIL', subject: d.subject, notes: d.body.slice(0, 2000) } });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'Lead', entityId: lead.id, summary: `Emailed ${lead.email}` });
    revalidatePath(`/sales/${lead.id}`);
    return { ok: true };
  } catch (err) { return toActionError(err); }
}
