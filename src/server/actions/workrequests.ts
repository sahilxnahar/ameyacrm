'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { ensure, getActionContext, toActionError } from './_helpers';
import { canTransition, isTerminal, type WRSide, type WRStatus } from '@/lib/workrequests/lifecycle';
import { userDeptIds } from '@/server/services/workrequest-service';
import { ensureLink } from '@/server/services/links-service';
import { emit } from '@/lib/events/bus';
import { fireAndForget } from '@/lib/resilience/safely';
import '@/lib/events/subscribers'; // registers the notification subscribers

export type WRResult = { ok: true; message: string; id?: string } | { error: string };

const opt = (s: string) => { const t = (s ?? '').trim(); return t === '' ? null : t; };

async function nextReference(): Promise<string> {
  const n = await prisma.workRequest.count();
  return `WR-${String(n + 1).padStart(4, '0')}`;
}

/** Raise a request to another department. */
export async function raiseWorkRequest(v: Record<string, string>): Promise<WRResult> {
  try {
    const ctx = await ensure('workrequest.create');
    const title = z.string().trim().min(3, 'Give the request a clear title.').parse(v.title ?? '');
    const toDeptId = opt(v.toDeptId ?? '');
    if (!toDeptId) return { error: 'Choose the department you need this from.' };
    const mine = await userDeptIds(ctx.user.id);
    const fromDeptId = mine[0] ?? null;
    if (toDeptId === fromDeptId) return { error: 'Pick a different department — this is your own.' };

    const reference = await nextReference();
    const data = {
      reference,
      title,
      detail: opt(v.detail ?? ''),
      priority: (['LOW', 'NORMAL', 'HIGH', 'URGENT'].includes(v.priority ?? '') ? v.priority : 'NORMAL'),
      status: 'RAISED',
      fromDeptId,
      toDeptId,
      raisedById: ctx.user.id,
      dueOn: v.dueOn && v.dueOn.trim() ? new Date(v.dueOn) : null,
      entityType: opt(v.entityType ?? ''),
      entityId: opt(v.entityId ?? ''),
    };
    let created;
    try {
      created = await prisma.workRequest.create({ data, select: { id: true, reference: true } });
    } catch {
      // Extremely unlikely reference clash — retry once with a random suffix.
      created = await prisma.workRequest.create({ data: { ...data, reference: `${reference}-${Math.floor(Math.random() * 900 + 100)}` }, select: { id: true, reference: true } });
    }
    await prisma.workRequestEvent.create({ data: { requestId: created.id, actorId: ctx.user.id, toStatus: 'RAISED' } });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'WorkRequest', entityId: created.id, summary: `Raised "${title}"` });
    // Announce it — the receiving department gets notified. Fire-and-forget so a
    // notification hiccup can never fail the request itself.
    fireAndForget(() => emit({ type: 'workrequest.raised', requestId: created.id, reference: created.reference, title, toDeptId, entityType: data.entityType, entityId: data.entityId, actorId: ctx.user.id }), 'emit workrequest.raised');
    revalidatePath('/work-requests');
    return { ok: true, message: 'Request raised.', id: created.id };
  } catch (e) { return toActionError(e); }
}

/** Move a request along its lifecycle, checking the mover is on the right side. */
export async function advanceWorkRequest(id: string, toStatus: string, note?: string): Promise<WRResult> {
  try {
    const ctx = await ensure('workrequest.view');
    const wr = await prisma.workRequest.findUnique({ where: { id }, select: { id: true, reference: true, status: true, fromDeptId: true, toDeptId: true, raisedById: true, title: true, detail: true, dueOn: true, linkedTaskId: true } });
    if (!wr) return { error: 'That request no longer exists.' };
    if (isTerminal(wr.status as WRStatus)) return { error: 'This request is already closed.' };

    const mine = await userDeptIds(ctx.user.id);
    const isReceiver = wr.toDeptId ? mine.includes(wr.toDeptId) : false;
    const isRaiser = wr.raisedById === ctx.user.id || (wr.fromDeptId ? mine.includes(wr.fromDeptId) : false);
    const side: WRSide | null = isReceiver ? 'receiver' : isRaiser ? 'raiser' : null;
    if (!side) return { error: 'This request is not to or from your department.' };
    if (side === 'receiver' && !(await ensureManage(ctx.permissions))) return { error: 'You need the "manage work requests" permission to action this.' };

    if (!canTransition(wr.status as WRStatus, side, toStatus as WRStatus)) {
      return { error: 'That is not a valid next step for this request.' };
    }

    const now = new Date();
    const patch: Record<string, unknown> = { status: toStatus };
    if (toStatus === 'ACCEPTED') patch.ownerId = ctx.user.id;
    if (toStatus === 'CONFIRMED') { patch.confirmedAt = now; patch.closedAt = now; }
    if (toStatus === 'REJECTED') patch.closedAt = now;

    // On acceptance, spawn a task for the receiving team so it shows in their queue.
    if (toStatus === 'ACCEPTED' && !wr.linkedTaskId) {
      const task = await prisma.task.create({
        data: {
          reference: `T-${Date.now().toString(36).toUpperCase()}`,
          title: `[Request] ${wr.title}`,
          description: wr.detail ?? null,
          status: 'TODO',
          priority: 'MEDIUM',
          departmentId: wr.toDeptId,
          createdById: ctx.user.id,
          dueDate: wr.dueOn,
        },
        select: { id: true },
      });
      patch.linkedTaskId = task.id;
      // Link the spawned task back to the request so it shows in Related activity.
      await ensureLink({ type: 'WorkRequest', id }, { type: 'Task', id: task.id }, 'spawned', ctx.user.id);
    }

    await prisma.workRequest.update({ where: { id }, data: patch });
    await prisma.workRequestEvent.create({ data: { requestId: id, actorId: ctx.user.id, fromStatus: wr.status, toStatus, note: (note ?? '').trim() || null } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'WorkRequest', entityId: id, summary: `${wr.status} → ${toStatus}` });
    // Announce the move — the person who raised it is notified where it now stands.
    fireAndForget(() => emit({ type: 'workrequest.advanced', requestId: id, reference: wr.reference, title: wr.title, toStatus, raiserId: wr.raisedById, actorId: ctx.user.id }), 'emit workrequest.advanced');
    revalidatePath('/work-requests');
    revalidatePath(`/work-requests/${id}`);
    return { ok: true, message: 'Updated.' };
  } catch (e) { return toActionError(e); }
}

export async function commentWorkRequest(id: string, body: string): Promise<WRResult> {
  try {
    const ctx = await getActionContext();
    const text = z.string().trim().min(1, 'Write something first.').max(4000).parse(body);
    const wr = await prisma.workRequest.findUnique({ where: { id }, select: { id: true } });
    if (!wr) return { error: 'That request no longer exists.' };
    await prisma.workRequestComment.create({ data: { requestId: id, authorId: ctx.user.id, body: text } });
    revalidatePath(`/work-requests/${id}`);
    return { ok: true, message: 'Comment added.' };
  } catch (e) { return toActionError(e); }
}

async function ensureManage(permissions: { isSuperAdmin: boolean; keys: Set<string> }): Promise<boolean> {
  return permissions.isSuperAdmin || permissions.keys.has('*') || permissions.keys.has('workrequest.manage');
}
