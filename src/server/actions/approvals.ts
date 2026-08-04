'use server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { notify } from '@/lib/notifications/notify';
import { writeAudit } from '@/lib/audit/log';
import { getActionContext, toActionError } from './_helpers';

export type ApprovalResult = { ok: true } | { error: string };

/**
 * Generic approval decision. Authorization is being the *named approver* on the
 * step (no separate permission needed). Recomputes the request outcome and
 * propagates it to the underlying entity where applicable.
 */
export async function decideApprovalStep(stepId: string, decision: 'APPROVED' | 'REJECTED', comment?: string): Promise<ApprovalResult> {
  try {
    const ctx = await getActionContext();
    const step = await prisma.approvalStep.findUnique({ where: { id: stepId }, include: { request: true } });
    if (!step || step.approverId !== ctx.user.id || step.status !== 'PENDING') return { error: 'No pending approval for you here.' };

    await prisma.approvalStep.update({ where: { id: stepId }, data: { status: decision, comment: comment || null, decidedAt: new Date() } });
    const remaining = await prisma.approvalStep.count({ where: { requestId: step.requestId, status: 'PENDING' } });
    const finalStatus = decision === 'REJECTED' ? 'REJECTED' : remaining === 0 ? 'APPROVED' : 'PENDING';

    if (finalStatus !== 'PENDING') {
      await prisma.approvalRequest.update({ where: { id: step.requestId }, data: { status: finalStatus } });
      const { entityType, entityId } = step.request;
      /*
       * ── AMH-007 ──────────────────────────────────────────────────────────
       *
       * Each of these ended in `.catch(() => {})`. The approval was recorded,
       * the requester was notified "your RA bill was approved" — and the bill
       * itself stayed PENDING, because the one write that changes what the
       * business does was the one whose failure was thrown away.
       *
       * The result is three records that disagree and nobody knowing which is
       * right. An approval that did not take effect has to say so.
       */
      try {
        if (entityType === 'MATERIAL_REQUEST') {
          await prisma.materialRequest.update({ where: { id: entityId }, data: { status: finalStatus === 'APPROVED' ? 'APPROVED' : 'REJECTED' } });
        } else if (entityType === 'PURCHASE_ORDER') {
          await prisma.purchaseOrder.update({ where: { id: entityId }, data: { status: finalStatus === 'APPROVED' ? 'APPROVED' : 'CANCELLED' } });
        } else if (entityType === 'RA_BILL') {
          await prisma.raBill.update({
            where: { id: entityId },
            data: finalStatus === 'APPROVED'
              ? { status: 'CERTIFIED', certifiedById: ctx.user.id, certifiedAt: new Date() }
              : { status: 'REJECTED' },
          });
        }
      } catch (err) {
        // Put the request back to PENDING so the decision can simply be made
        // again — better than leaving an approved request over an untouched
        // record, which nothing in the product would ever reconcile.
        await prisma.approvalRequest.update({ where: { id: step.requestId }, data: { status: 'PENDING' } }).catch(() => undefined);
        await prisma.approvalStep.update({ where: { id: stepId }, data: { status: 'PENDING', decidedAt: null } }).catch(() => undefined);
        await writeAudit({
          actorId: ctx.user.id, action: 'REJECT', entityType, entityId,
          summary: `Approval could not be applied to the ${entityType.toLowerCase().replace('_', ' ')} — ${err instanceof Error ? err.message : 'update failed'}. The decision was rolled back.`,
        }).catch(() => undefined);
        return {
          error: `The decision was recorded but could not be applied to the ${entityType.toLowerCase().replace('_', ' ')}, `
            + 'so it has been rolled back. Nothing has changed — reload and try again.',
        };
      }
    }
    await notify({ userId: step.request.requesterId, type: 'APPROVAL', title: `Your ${step.request.entityType.toLowerCase().replace('_', ' ')} was ${decision.toLowerCase()}`, link: '/approvals' });
    await writeAudit({ actorId: ctx.user.id, action: decision === 'APPROVED' ? 'APPROVE' : 'REJECT', entityType: step.request.entityType, entityId: step.request.entityId, summary: comment || undefined });
    revalidatePath('/approvals');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}
