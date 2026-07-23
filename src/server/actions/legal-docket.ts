'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from './_helpers';

export type DocketResult = { ok: true; id?: string } | { error: string };

const optDate = (s?: string | null) => (s ? new Date(s) : null);

const hearingSchema = z.object({
  id: z.string().optional(),
  matterId: z.string().min(1),
  date: z.string().min(1, 'Pick the hearing date'),
  purpose: z.string().max(200).optional().nullable(),
  outcome: z.string().max(2000).optional().nullable(),
  nextDate: z.string().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  updateMatterNext: z.boolean().optional(),
});

/** Add or edit a hearing in a matter's docket. Optionally rolls the matter's next date forward. */
export async function saveHearing(input: unknown): Promise<DocketResult> {
  try {
    const ctx = await ensure('land.manage');
    const d = hearingSchema.parse(input);
    const matter = await prisma.litigationMatter.findUnique({ where: { id: d.matterId }, select: { id: true, title: true } });
    if (!matter) return { error: 'Matter not found.' };
    const data = { matterId: d.matterId, date: new Date(d.date), purpose: d.purpose || null, outcome: d.outcome || null, nextDate: optDate(d.nextDate), notes: d.notes || null };
    const saved = d.id
      ? await prisma.litigationHearing.update({ where: { id: d.id }, data, select: { id: true } })
      : await prisma.litigationHearing.create({ data: { ...data, createdById: ctx.user.id }, select: { id: true } });
    if (d.updateMatterNext && d.nextDate) {
      await prisma.litigationMatter.update({ where: { id: d.matterId }, data: { nextHearing: new Date(d.nextDate) } });
    }
    await writeAudit({ actorId: ctx.user.id, action: d.id ? 'UPDATE' : 'CREATE', entityType: 'LitigationHearing', entityId: saved.id, summary: `Hearing on ${d.date.slice(0, 10)} — ${matter.title}` });
    revalidatePath('/litigation');
    return { ok: true, id: saved.id };
  } catch (e) { return toActionError(e); }
}

export async function deleteHearing(id: string): Promise<DocketResult> {
  try {
    const ctx = await ensure('land.manage');
    const h = await prisma.litigationHearing.findUnique({ where: { id }, select: { id: true } });
    if (!h) return { error: 'Hearing not found.' };
    await prisma.litigationHearing.delete({ where: { id } });
    await writeAudit({ actorId: ctx.user.id, action: 'DELETE', entityType: 'LitigationHearing', entityId: id, summary: 'Deleted a hearing' });
    revalidatePath('/litigation');
    return { ok: true };
  } catch (e) { return toActionError(e); }
}

const expirySchema = z.object({
  id: z.string().min(1),
  expiresOn: z.string().optional().nullable(),
  renewalNote: z.string().max(500).optional().nullable(),
});

/** Set (or clear) the renewal/expiry date and note on a title document — EC, Khata, etc. */
export async function setTitleExpiry(input: unknown): Promise<DocketResult> {
  try {
    const ctx = await ensure('land.manage');
    const d = expirySchema.parse(input);
    const doc = await prisma.titleDocument.findUnique({ where: { id: d.id }, select: { title: true } });
    if (!doc) return { error: 'Document not found.' };
    await prisma.titleDocument.update({ where: { id: d.id }, data: { expiresOn: optDate(d.expiresOn), renewalNote: d.renewalNote || null } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'TitleDocument', entityId: d.id, summary: d.expiresOn ? `Renewal date set for ${doc.title}` : `Renewal tracking cleared for ${doc.title}` });
    revalidatePath('/litigation');
    revalidatePath('/land');
    return { ok: true };
  } catch (e) { return toActionError(e); }
}
