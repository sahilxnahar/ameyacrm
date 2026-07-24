'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { nextReference } from '@/lib/utils/reference';
import { runAutomations } from '@/lib/automation/engine';
import { ensure, toActionError } from './_helpers';

const schema = z.object({
  name: z.string().min(2).max(120),
  phone: z.string().min(5).max(30),
  email: z.string().email().optional().or(z.literal('')),
  projectId: z.string().optional().nullable(),
  requirement: z.string().max(300).optional(),
  budget: z.coerce.number().nonnegative().optional(),
  sourceNote: z.string().max(120).optional(),
});

/** Kiosk walk-in check-in → instantly creates a lead (WALK_IN) with a SITE_VISIT activity and runs routing automations. */
export async function checkInVisitor(input: unknown): Promise<{ ok: true; id: string; reference: string } | { error: string }> {
  try {
    const ctx = await ensure('lead.create');
    const d = schema.parse(input);
    const reference = await nextReference('LEAD');
    const notes = d.sourceNote ? `Walk-in source: ${d.sourceNote}` : 'Walk-in site visit';
    const lead = await prisma.lead.create({
      data: {
        reference, name: d.name, phone: d.phone, email: d.email || null, source: 'WALK_IN',
        requirement: d.requirement || null, budgetMax: d.budget ?? null, projectId: d.projectId || null, ownerId: ctx.user.id,
        activities: { create: { userId: ctx.user.id, type: 'SITE_VISIT', subject: 'Site visit check-in', notes } },
      },
    });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'Lead', entityId: lead.id, summary: `Site-visit check-in ${reference}` });
    await runAutomations('LEAD_CREATED', { entityType: 'Lead', entityId: lead.id, data: { name: lead.name, phone: lead.phone, email: lead.email, source: 'WALK_IN', status: lead.status, score: lead.score }, actorId: ctx.user.id });
    revalidatePath('/sales');
    return { ok: true, id: lead.id, reference };
  } catch (err) { return toActionError(err); }
}
