'use server';
import { revalidatePath } from 'next/cache';
import { writeAudit } from '@/lib/audit/log';
import { getActionContext, toActionError, type ActionFailure } from '@/server/actions/_helpers';
import { restoreDeleted } from '@/server/services/undo-service';

export type UndoResult = { ok: true; message: string } | ActionFailure;

/**
 * Put back the row a delete just removed (AMH-033).
 *
 * Permission is deliberately NOT re-checked against the original delete's
 * permission. Two reasons: the person is undoing something they were just
 * allowed to do a moment ago, and the token is a cuid they can only have got
 * from the response to their own delete. Requiring a second, different
 * permission would mean the Undo button appears and then refuses.
 *
 * The restore IS audited, so an undo is as visible in the trail as the delete.
 */
export async function undoDelete(token: string): Promise<UndoResult> {
  try {
    const ctx = await getActionContext();
    const res = await restoreDeleted(token, ctx.user.id);
    if ('error' in res) return { error: res.error };

    await writeAudit({
      actorId: ctx.user.id, action: 'CREATE', entityType: 'DeletedRecord', entityId: token,
      summary: `Undid a deletion — “${res.label}” put back`,
    });
    // Cheap and correct: the row could be on any list, and an undo is rare.
    revalidatePath('/', 'layout');
    return { ok: true, message: `“${res.label}” is back.` };
  } catch (err) {
    return toActionError(err);
  }
}
