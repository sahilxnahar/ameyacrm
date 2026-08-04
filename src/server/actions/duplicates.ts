'use server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from './_helpers';

export type MergeResult = { ok: true; movedActivities: number; movedBookings: number } | { error: string };

/** Merge duplicate leads into a primary: re-parents history, back-fills blanks, archives the duplicates. */
export async function mergeLeads(primaryId: string, duplicateIds: string[]): Promise<MergeResult> {
  try {
    const ctx = await ensure('lead.delete');
    const dupes = duplicateIds.filter((id) => id && id !== primaryId);
    if (!dupes.length) return { error: 'Select at least one duplicate to merge.' };

    const primary = await prisma.lead.findUnique({ where: { id: primaryId } });
    if (!primary) return { error: 'Primary lead not found.' };
    const others = await prisma.lead.findMany({ where: { id: { in: dupes }, deletedAt: null } });
    if (!others.length) return { error: 'No valid duplicates found.' };

    // Back-fill any blank fields on the primary from the duplicates.
    const patch: Record<string, unknown> = {};
    const pick = <K extends keyof (typeof others)[number]>(field: K) => {
      if ((primary as Record<string, unknown>)[field as string]) return;
      const found = others.find((o) => o[field]);
      if (found) patch[field as string] = found[field];
    };
    (['email', 'phone', 'requirement', 'projectId', 'ownerId', 'budgetMin', 'budgetMax', 'country', 'channelPartnerId'] as const).forEach((f) => pick(f as never));
    const mergedCustom = { ...(others.reduce((acc, o) => ({ ...acc, ...((o.customFields as Record<string, unknown>) ?? {}) }), {})), ...((primary.customFields as Record<string, unknown>) ?? {}) };
    if (Object.keys(mergedCustom).length) patch.customFields = mergedCustom;

    /*
     * All five writes, or none of them.
     *
     * A merge that half-applies is the worst outcome available here: either the
     * activities and bookings have been reparented onto a lead that was never
     * archived — so the duplicate is still live and now empty — or the
     * duplicates are archived and their history was never moved, which loses
     * every call and site visit against them. Neither is visible without
     * reading the audit log, and neither is reversible from the UI.
     */
    const { act, bk } = await prisma.$transaction(async (tx) => {
      const act = await tx.leadActivity.updateMany({ where: { leadId: { in: dupes } }, data: { leadId: primaryId } });
      const bk = await tx.booking.updateMany({ where: { leadId: { in: dupes } }, data: { leadId: primaryId } });
      if (Object.keys(patch).length) await tx.lead.update({ where: { id: primaryId }, data: patch });
      await tx.lead.updateMany({ where: { id: { in: dupes } }, data: { deletedAt: new Date() } });
      await tx.leadActivity.create({
        data: {
          leadId: primaryId, userId: ctx.user.id, type: 'NOTE', subject: 'Duplicates merged',
          notes: `Merged ${others.length} duplicate record(s): ${others.map((o) => o.reference).join(', ')}`,
        },
      });
      return { act, bk };
    });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'Lead', entityId: primaryId, summary: `Merged ${others.length} duplicate(s) into ${primary.reference}` });
    revalidatePath('/sales'); revalidatePath('/sales/duplicates');
    return { ok: true, movedActivities: act.count, movedBookings: bk.count };
  } catch (err) { return toActionError(err); }
}
