'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { nextReference } from '@/lib/utils/reference';
import { sendEmail, renderTemplate } from '@/lib/email/email';
import { notifyMany } from '@/lib/notifications/notify';
import { writeAudit } from '@/lib/audit/log';
import { formatDate } from '@/lib/utils/format';
import { ensure, toActionError } from './_helpers';

export type MRResult = { ok: true; id: string } | { error: string };

const itemSchema = z.object({ material: z.string().min(1), quantity: z.coerce.number().positive(), unit: z.string().default('nos'), spec: z.string().optional() });
const createSchema = z.object({
  title: z.string().min(3).max(200),
  projectId: z.string().optional().nullable(),
  departmentId: z.string().optional().nullable(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  neededBy: z.string().optional().nullable(),
  notes: z.string().max(2000).optional(),
  recipientEmail: z.string().email('A valid recipient email is required'),
  approverIds: z.array(z.string()).default([]),
  items: z.array(itemSchema).min(1, 'Add at least one material line'),
});

/**
 * Create a material request, generate a structured email from the template,
 * open an approval workflow, and notify approvers. This is the "Site Engineer
 * requests Cement/Steel/…" flow, end to end.
 */
export async function createMaterialRequest(input: unknown): Promise<MRResult> {
  try {
    const ctx = await ensure('material.create');
    const d = createSchema.parse(input);
    const reference = await nextReference('MR');

    const mr = await prisma.materialRequest.create({
      data: {
        reference, title: d.title, projectId: d.projectId || null,
        departmentId: d.departmentId || ctx.user.departmentId || null,
        requesterId: ctx.user.id, priority: d.priority,
        neededBy: d.neededBy ? new Date(d.neededBy) : null, notes: d.notes || null,
        status: d.approverIds.length ? 'SUBMITTED' : 'DRAFT',
        items: { create: d.items.map((i) => ({ material: i.material, quantity: i.quantity, unit: i.unit, spec: i.spec || null })) },
      },
      include: { project: { select: { name: true } }, department: { select: { name: true } }, items: true },
    });

    // Build the structured email from the stored template.
    const template = await prisma.emailTemplate.findUnique({ where: { key: 'material_request' } });
    const itemsText = mr.items.map((i) => `• ${i.material} — ${i.quantity} ${i.unit}${i.spec ? ` (${i.spec})` : ''}`).join('\n');
    const vars = {
      priority: d.priority, reference, project: mr.project?.name ?? '—', department: mr.department?.name ?? '—',
      recipient: d.recipientEmail, neededBy: d.neededBy ? formatDate(d.neededBy) : 'ASAP',
      items: itemsText, requester: ctx.user.name, notes: d.notes ?? '—',
    };
    const subject = template ? renderTemplate(template.subject, vars) : `[${d.priority}] Material Request ${reference}`;
    const body = template ? renderTemplate(template.body, vars) : `${d.title}\n\n${itemsText}`;

    const email = await prisma.emailMessage.create({
      data: { fromUserId: ctx.user.id, toEmails: [d.recipientEmail], subject, body, templateKey: 'material_request', materialRequestId: mr.id, status: 'QUEUED' },
    });

    // Approval workflow
    if (d.approverIds.length) {
      const approval = await prisma.approvalRequest.create({
        data: {
          entityType: 'MATERIAL_REQUEST', entityId: mr.id, requesterId: ctx.user.id, materialRequestId: mr.id,
          steps: { create: d.approverIds.map((approverId, idx) => ({ approverId, sequence: idx + 1 })) },
        },
      });
      await notifyMany(d.approverIds, { type: 'APPROVAL', title: `Approve material request ${reference}`, body: d.title, link: `/material-requests/${mr.id}` });
      await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'ApprovalRequest', entityId: approval.id, summary: `Approval opened for ${reference}` });
    }

    // Send the email (provider pluggable; 'console' logs in dev).
    const result = await sendEmail({ to: [d.recipientEmail], subject, text: body });
    await prisma.emailMessage.update({ where: { id: email.id }, data: { status: result.ok ? 'SENT' : 'FAILED', sentAt: result.ok ? new Date() : null, error: result.error } });

    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'MaterialRequest', entityId: mr.id, summary: `Raised ${reference}` });
    revalidatePath('/material-requests');
    return { ok: true, id: mr.id };
  } catch (err) {
    return toActionError(err);
  }
}

export async function decideMaterialRequest(mrId: string, decision: 'APPROVED' | 'REJECTED', comment?: string): Promise<MRResult> {
  try {
    const ctx = await ensure('material.approve');
    const step = await prisma.approvalStep.findFirst({
      where: { request: { materialRequestId: mrId }, approverId: ctx.user.id, status: 'PENDING' },
      include: { request: true },
    });
    if (!step) return { error: 'No pending approval for you on this request.' };

    await prisma.approvalStep.update({ where: { id: step.id }, data: { status: decision, comment: comment || null, decidedAt: new Date() } });
    const remaining = await prisma.approvalStep.count({ where: { requestId: step.requestId, status: 'PENDING' } });
    const finalStatus = decision === 'REJECTED' ? 'REJECTED' : remaining === 0 ? 'APPROVED' : 'PENDING';
    if (finalStatus !== 'PENDING') {
      await prisma.approvalRequest.update({ where: { id: step.requestId }, data: { status: finalStatus } });
      await prisma.materialRequest.update({ where: { id: mrId }, data: { status: finalStatus === 'APPROVED' ? 'APPROVED' : 'REJECTED' } });
    }
    const mr = await prisma.materialRequest.findUnique({ where: { id: mrId } });
    if (mr) await notifyMany([mr.requesterId], { type: 'APPROVAL', title: `${mr.reference} ${decision.toLowerCase()}`, link: `/material-requests/${mrId}` });
    await writeAudit({ actorId: ctx.user.id, action: decision === 'APPROVED' ? 'APPROVE' : 'REJECT', entityType: 'MaterialRequest', entityId: mrId });
    revalidatePath('/material-requests');
    return { ok: true, id: mrId };
  } catch (err) {
    return toActionError(err);
  }
}
