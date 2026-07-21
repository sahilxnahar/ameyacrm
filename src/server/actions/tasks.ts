'use server';
import { z } from 'zod';
import { nextDueDate, type RepeatUnit } from '@/lib/tasks/recurrence';
import { revalidatePath } from 'next/cache';
import type { TaskStatus } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { nextReference } from '@/lib/utils/reference';
import { notify, notifyMany } from '@/lib/notifications/notify';
import { writeAudit } from '@/lib/audit/log';
import { runAutomations } from '@/lib/automation/engine';
import { ensure, getActionContext, toActionError } from './_helpers';

const createSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(200),
  description: z.string().max(5000).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  status: z.enum(['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'BLOCKED', 'DONE', 'CANCELLED']).default('TODO'),
  departmentId: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  estimateMins: z.coerce.number().int().positive().optional().nullable(),
  assigneeIds: z.array(z.string()).default([]),
  // Repeats. Left empty for a one-off, which is most tasks.
  repeatEvery: z.coerce.number().int().min(1).max(365).optional().nullable(),
  repeatUnit: z.enum(['DAY', 'WEEK', 'MONTH', 'YEAR']).optional().nullable(),
  repeatUntil: z.string().optional().nullable(),
});

export type TaskActionResult = { ok: true; id: string; message?: string } | { error: string };

export async function createTask(input: unknown): Promise<TaskActionResult> {
  try {
    const ctx = await ensure('task.create');
    const data = createSchema.parse(input);
    const reference = await nextReference('TSK');

    const task = await prisma.task.create({
      data: {
        reference,
        title: data.title,
        description: data.description || null,
        priority: data.priority,
        status: data.status,
        departmentId: data.departmentId || null,
        projectId: data.projectId || null,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        estimateMins: data.estimateMins || null,
        repeatEvery: data.repeatEvery || null,
        repeatUnit: data.repeatEvery ? data.repeatUnit ?? 'MONTH' : null,
        repeatUntil: data.repeatUntil ? new Date(data.repeatUntil) : null,
        createdById: ctx.user.id,
        assignees: { create: data.assigneeIds.map((userId) => ({ userId })) },
        activities: { create: { actorId: ctx.user.id, action: 'created' } },
      },
    });

    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'Task', entityId: task.id, summary: `Created task ${reference}` });
    await notifyMany(data.assigneeIds.filter((id) => id !== ctx.user.id), {
      type: 'TASK_ASSIGNED', title: `New task: ${data.title}`,
      body: `${ctx.user.name} assigned you ${reference}`, link: `/tasks/${task.id}`,
    });
    await runAutomations('TASK_CREATED', { entityType: 'Task', entityId: task.id, data: { title: task.title, priority: task.priority, status: task.status }, actorId: ctx.user.id });
    revalidatePath('/tasks');
    return { ok: true, id: task.id };
  } catch (err) {
    return toActionError(err);
  }
}

export async function moveTask(taskId: string, status: TaskStatus, position: number): Promise<TaskActionResult> {
  try {
    const ctx = await ensure('task.update');
    const task = await prisma.task.update({
      where: { id: taskId },
      data: { status, position, completedAt: status === 'DONE' ? new Date() : null },
      include: { assignees: true, watchers: true },
    });
    await prisma.taskActivity.create({ data: { taskId, actorId: ctx.user.id, action: 'status_changed', meta: { status } } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'Task', entityId: taskId, summary: `Moved ${task.reference} → ${status}` });
    const watchers = [...task.assignees.map((a) => a.userId), ...task.watchers.map((w) => w.userId), task.createdById];
    await notifyMany(watchers.filter((id) => id !== ctx.user.id), {
      type: 'TASK_UPDATED', title: `${task.reference} moved to ${status}`, link: `/tasks/${taskId}`,
    });
    await runAutomations('TASK_STATUS_CHANGED', { entityType: 'Task', entityId: taskId, data: { title: task.title, status, priority: task.priority }, actorId: ctx.user.id });

    // A repeating task creates its successor only once it is done, so a job
    // nobody gets to cannot pile up fifty copies.
    let repeated: string | null = null;
    if (status === 'DONE' && task.repeatEvery && task.repeatUnit) {
      repeated = await spawnNextOccurrence(task.id, ctx.user.id);
    }

    revalidatePath('/tasks');
    return { ok: true, id: taskId, message: repeated ? `Next one is due ${repeated}.` : undefined };
  } catch (err) {
    return toActionError(err);
  }
}

const respondSchema = z.object({
  taskId: z.string(),
  action: z.enum(['ACCEPT', 'REJECT', 'CLARIFY', 'COMPLETE']),
  reason: z.string().max(1000).optional(),
});

export async function respondToAssignment(input: unknown): Promise<TaskActionResult> {
  try {
    const ctx = await getActionContext();
    const { taskId, action, reason } = respondSchema.parse(input);
    const assignment = await prisma.taskAssignee.findUnique({ where: { taskId_userId: { taskId, userId: ctx.user.id } }, include: { task: true } });
    if (!assignment) return { error: 'You are not assigned to this task.' };
    if ((action === 'REJECT' || action === 'CLARIFY') && !reason?.trim()) {
      return { error: 'Please provide a reason.' };
    }

    const stateMap = { ACCEPT: 'ACCEPTED', REJECT: 'REJECTED', CLARIFY: 'CLARIFICATION_REQUESTED', COMPLETE: 'COMPLETED' } as const;
    await prisma.taskAssignee.update({
      where: { taskId_userId: { taskId, userId: ctx.user.id } },
      data: { state: stateMap[action], reason: reason || null, respondedAt: new Date(), progressPct: action === 'COMPLETE' ? 100 : undefined },
    });
    await prisma.taskActivity.create({ data: { taskId, actorId: ctx.user.id, action: `assignment_${action.toLowerCase()}`, meta: reason ? { reason } : undefined } });
    await notify({
      userId: assignment.task.createdById, type: 'TASK_UPDATED',
      title: `${ctx.user.name} ${action.toLowerCase()}ed ${assignment.task.reference}`,
      body: reason || undefined, link: `/tasks/${taskId}`,
    });
    revalidatePath(`/tasks/${taskId}`);
    return { ok: true, id: taskId };
  } catch (err) {
    return toActionError(err);
  }
}

export async function addTaskComment(taskId: string, body: string): Promise<TaskActionResult> {
  try {
    const ctx = await ensure('task.comment');
    if (!body.trim()) return { error: 'Comment cannot be empty.' };
    const mentions = [...body.matchAll(/@([a-zA-Z0-9_.]+)/g)].map((m) => m[1]!);
    const mentionedUsers = mentions.length
      ? await prisma.user.findMany({ where: { username: { in: mentions } }, select: { id: true } })
      : [];
    await prisma.taskComment.create({ data: { taskId, authorId: ctx.user.id, body, mentions: mentionedUsers.map((u) => u.id) } });
    await prisma.taskActivity.create({ data: { taskId, actorId: ctx.user.id, action: 'commented' } });
    const task = await prisma.task.findUnique({ where: { id: taskId }, include: { assignees: true } });
    if (task) {
      await notifyMany(
        [...task.assignees.map((a) => a.userId), task.createdById].filter((id) => id !== ctx.user.id),
        { type: 'COMMENT', title: `New comment on ${task.reference}`, body: body.slice(0, 80), link: `/tasks/${taskId}` },
      );
      await notifyMany(mentionedUsers.map((u) => u.id), { type: 'MENTION', title: `${ctx.user.name} mentioned you`, link: `/tasks/${taskId}` });
    }
    revalidatePath(`/tasks/${taskId}`);
    return { ok: true, id: taskId };
  } catch (err) {
    return toActionError(err);
  }
}

export async function toggleChecklistItem(itemId: string, isDone: boolean): Promise<TaskActionResult> {
  try {
    await ensure('task.update');
    const item = await prisma.checklistItem.update({ where: { id: itemId }, data: { isDone } });
    revalidatePath(`/tasks/${item.taskId}`);
    return { ok: true, id: item.taskId };
  } catch (err) {
    return toActionError(err);
  }
}

export async function updateAssignmentProgress(taskId: string, progressPct: number): Promise<TaskActionResult> {
  try {
    const ctx = await getActionContext();
    await prisma.taskAssignee.update({
      where: { taskId_userId: { taskId, userId: ctx.user.id } },
      data: { progressPct: Math.max(0, Math.min(100, progressPct)) },
    });
    revalidatePath(`/tasks/${taskId}`);
    return { ok: true, id: taskId };
  } catch (err) {
    return toActionError(err);
  }
}

// ─── Subtasks, dependencies, labels, time tracking (Tasks depth) ────────────

export async function addSubtask(parentId: string, title: string): Promise<TaskActionResult> {
  try {
    const ctx = await ensure('task.create');
    if (title.trim().length < 3) return { error: 'Subtask title too short.' };
    const parent = await prisma.task.findUnique({ where: { id: parentId } });
    if (!parent) return { error: 'Parent task not found.' };
    const reference = await nextReference('TSK');
    const sub = await prisma.task.create({
      data: { reference, title, status: 'TODO', priority: parent.priority, parentId, projectId: parent.projectId, departmentId: parent.departmentId, createdById: ctx.user.id },
    });
    await prisma.taskActivity.create({ data: { taskId: parentId, actorId: ctx.user.id, action: 'subtask_added' } });
    revalidatePath(`/tasks/${parentId}`);
    return { ok: true, id: sub.id };
  } catch (err) { return toActionError(err); }
}

export async function addTaskDependency(taskId: string, dependsOnId: string): Promise<TaskActionResult> {
  try {
    await ensure('task.update');
    if (taskId === dependsOnId) return { error: 'A task cannot depend on itself.' };
    await prisma.taskDependency.create({ data: { taskId, dependsOnId } }).catch(() => { throw new Error('Dependency already exists.'); });
    revalidatePath(`/tasks/${taskId}`);
    return { ok: true, id: taskId };
  } catch (err) { return toActionError(err); }
}

export async function setTaskLabels(taskId: string, labelIds: string[]): Promise<TaskActionResult> {
  try {
    await ensure('task.update');
    await prisma.$transaction([
      prisma.taskLabelOnTask.deleteMany({ where: { taskId } }),
      prisma.taskLabelOnTask.createMany({ data: labelIds.map((labelId) => ({ taskId, labelId })) }),
    ]);
    revalidatePath(`/tasks/${taskId}`);
    return { ok: true, id: taskId };
  } catch (err) { return toActionError(err); }
}

export async function logTaskTime(taskId: string, minutes: number): Promise<TaskActionResult> {
  try {
    const ctx = await ensure('task.update');
    if (!Number.isFinite(minutes) || minutes <= 0) return { error: 'Enter minutes greater than zero.' };
    const task = await prisma.task.update({ where: { id: taskId }, data: { actualMins: { increment: Math.round(minutes) } } });
    await prisma.taskActivity.create({ data: { taskId, actorId: ctx.user.id, action: 'time_logged', meta: { minutes } } });
    revalidatePath(`/tasks/${taskId}`);
    return { ok: true, id: task.id };
  } catch (err) { return toActionError(err); }
}


/**
 * Create the next occurrence of a repeating task.
 *
 * Copies the wording, priority, project and the people, but not the comments
 * or the time already logged — those belong to the occurrence that happened.
 */
async function spawnNextOccurrence(taskId: string, actorId: string): Promise<string | null> {
  const prev = await prisma.task.findUnique({
    where: { id: taskId },
    include: { assignees: { select: { userId: true } } },
  });
  if (!prev?.repeatEvery || !prev.repeatUnit) return null;

  const base = prev.dueDate ?? new Date();
  const due = nextDueDate(base, prev.repeatEvery, prev.repeatUnit as RepeatUnit);
  if (prev.repeatUntil && due > prev.repeatUntil) return null;

  const reference = await nextReference('TSK');
  await prisma.task.create({
    data: {
      reference,
      title: prev.title,
      description: prev.description,
      priority: prev.priority,
      status: 'TODO',
      departmentId: prev.departmentId,
      projectId: prev.projectId,
      dueDate: due,
      estimateMins: prev.estimateMins,
      repeatEvery: prev.repeatEvery,
      repeatUnit: prev.repeatUnit,
      repeatUntil: prev.repeatUntil,
      repeatedFromId: prev.id,
      createdById: prev.createdById,
      assignees: { create: prev.assignees.map((a) => ({ userId: a.userId })) },
      activities: { create: { actorId, action: 'created' } },
    },
  });
  await notifyMany(prev.assignees.map((a) => a.userId).filter((id) => id !== actorId), {
    type: 'TASK_ASSIGNED',
    title: `Repeats: ${prev.title}`,
    body: `Next one is due ${due.toLocaleDateString('en-IN')}`,
    link: '/tasks',
  });
  return due.toLocaleDateString('en-IN');
}
