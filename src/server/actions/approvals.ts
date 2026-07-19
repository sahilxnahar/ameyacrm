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
      if (entityType === 'MATERIAL_REQUEST') {
        await prisma.materialRequest.update({ where: { id: entityId }, data: { status: finalStatus === 'APPROVED' ? 'APPROVED' : 'REJECTED' } }).catch(() => {});
      } else if (entityType === 'PURCHASE_ORDER') {
        await prisma.purchaseOrder.update({ where: { id: entityId }, data: { status: finalStatus === 'APPROVED' ? 'APPROVED' : 'CANCELLED' } }).catch(() => {});
      }
    }
    await notify({ userId: step.request.requesterId, type: 'APPROVAL', title: `Your ${step.request.entityType.toLowerCase().replace('_', ' ')} was ${decision.toLowerCase()}`, link: '/approvals' });
    await writeAudit({ actorId: ctx.user.id, action: decision === 'APPROVED' ? 'APPROVE' : 'REJECT', entityType: step.request.entityType, entityId: step.request.entityId, summary: comment || undefined });
    revalidatePath('/approvals');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}
