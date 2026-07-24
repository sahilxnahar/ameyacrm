'use server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { getActionContext, toActionError } from './_helpers';
import { getAccessContext } from '@/lib/access/context';
import { ensureLink } from '@/server/services/links-service';
import { isLinkable } from '@/lib/links/entities';

export type LinkResult = { ok: true } | { error: string };

/** Manually link two records together. Uses the one access context (I5) for the actor. */
export async function createRecordLink(fromType: string, fromId: string, toType: string, toId: string, kind = 'related'): Promise<LinkResult> {
  try {
    const base = await getActionContext();
    const ctx = await getAccessContext(base.user.id);
    if (!isLinkable(fromType) || !isLinkable(toType)) return { error: 'Those records cannot be linked.' };
    await ensureLink({ type: fromType, id: fromId }, { type: toType, id: toId }, kind, ctx.userId);
    revalidatePath(`/work-requests/${fromId}`);
    revalidatePath(`/work-requests/${toId}`);
    return { ok: true };
  } catch (e) { return toActionError(e); }
}

/** Remove a link. Anyone signed in who can see the record may tidy its links. */
export async function deleteRecordLink(linkId: string): Promise<LinkResult> {
  try {
    await getActionContext();
    const link = await prisma.recordLink.findUnique({ where: { id: linkId }, select: { id: true } });
    if (!link) return { ok: true };
    await prisma.recordLink.delete({ where: { id: linkId } });
    return { ok: true };
  } catch (e) { return toActionError(e); }
}
