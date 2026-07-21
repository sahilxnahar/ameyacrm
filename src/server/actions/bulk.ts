'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from '@/server/actions/_helpers';
import { notifyMany } from '@/lib/notifications/notify';

export type BulkResult = { ok: true; changed: number; message: string } | { error: string };

const ids = z.array(z.string().min(1)).min(1, 'Nothing was selected.').max(500, 'Too many at once — do 500 or fewer.');

const taskSchema = z.object({
  ids,
  action: z.enum(['status', 'priority', 'assign', 'due', 'department', 'delete']),
  status: z.enum(['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'BLOCKED', 'DONE', 'CANCELLED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  assigneeId: z.string().optional(),
  dueDate: z.string().optional(),
  departmentId: z.string().optional(),
});

/**
 * Do one thing to many tasks.
 *
 * Every path writes a single audit line naming the count rather than one line
 * per record, so bulk work does not bury the audit log.
 */
export async function bulkUpdateTasks(input: unknown): Promise<BulkResult> {
  try {
    const ctx = await ensure('task.update');
    const d = taskSchema.parse(input);
    const where = { id: { in: d.ids }, deletedAt: null };
    let changed = 0;
    let what = '';

    switch (d.action) {
      case 'status': {
        if (!d.status) return { error: 'Pick a status.' };
        const r = await prisma.task.updateMany({
          where,
          data: { status: d.status, completedAt: d.status === 'DONE' ? new Date() : null },
        });
        changed = r.count; what = `status → ${d.status}`;
        break;
      }
      case 'priority': {
        if (!d.priority) return { error: 'Pick a priority.' };
        const r = await prisma.task.updateMany({ where, data: { priority: d.priority } });
        changed = r.count; what = `priority → ${d.priority}`;
        break;
      }
      case 'due': {
        const due = d.dueDate ? new Date(d.dueDate) : null;
        if (d.dueDate && Number.isNaN(due?.getTime())) return { error: 'That date could not be read.' };
        const r = await prisma.task.updateMany({ where, data: { dueDate: due } });
        changed = r.count; what = due ? `due ${due.toLocaleDateString('en-IN')}` : 'due date cleared';
        break;
      }
      case 'department': {
        const r = await prisma.task.updateMany({ where, data: { departmentId: d.departmentId || null } });
        changed = r.count; what = 'department changed';
        break;
      }
      case 'assign': {
        if (!d.assigneeId) return { error: 'Pick who it goes to.' };
        const person = await prisma.user.findUnique({ where: { id: d.assigneeId }, select: { name: true } });
        if (!person) return { error: 'That person no longer exists.' };
        // Replace the assignees rather than adding to them — "assign to X"
        // meaning "and also keep the other four" surprises people.
        await prisma.taskAssignee.deleteMany({ where: { taskId: { in: d.ids } } });
        const rows = d.ids.map((taskId) => ({ taskId, userId: d.assigneeId! }));
        const r = await prisma.taskAssignee.createMany({ data: rows, skipDuplicates: true });
        changed = r.count; what = `assigned to ${person.name}`;
        await notifyMany([d.assigneeId], {
          type: 'TASK_ASSIGNED',
          title: `${changed} task${changed === 1 ? '' : 's'} assigned to you`,
          body: `${ctx.user.name} moved them across`,
          link: '/tasks',
        });
        break;
      }
      case 'delete': {
        await ensure('task.delete');
        const r = await prisma.task.updateMany({ where, data: { deletedAt: new Date() } });
        changed = r.count; what = 'deleted';
        break;
      }
    }

    await writeAudit({
      actorId: ctx.user.id, action: 'UPDATE', entityType: 'Task',
      summary: `Bulk: ${changed} task${changed === 1 ? '' : 's'} — ${what}`,
    });
    revalidatePath('/tasks');
    return { ok: true, changed, message: `${changed} task${changed === 1 ? '' : 's'} updated — ${what}.` };
  } catch (e) {
    return toActionError(e);
  }
}

const leadSchema = z.object({
  ids,
  action: z.enum(['status', 'owner', 'temperature', 'delete']),
  status: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'SITE_VISIT', 'NEGOTIATION', 'BOOKED', 'WON', 'LOST']).optional(),
  ownerId: z.string().optional(),
  temperature: z.enum(['HOT', 'WARM', 'COLD']).optional(),
});

/** Do one thing to many leads. */
export async function bulkUpdateLeads(input: unknown): Promise<BulkResult> {
  try {
    const ctx = await ensure('lead.update');
    const d = leadSchema.parse(input);
    const where = { id: { in: d.ids }, deletedAt: null };
    let changed = 0;
    let what = '';

    if (d.action === 'status') {
      if (!d.status) return { error: 'Pick a status.' };
      const r = await prisma.lead.updateMany({ where, data: { status: d.status } });
      changed = r.count; what = `status → ${d.status}`;
    } else if (d.action === 'owner') {
      if (!d.ownerId) return { error: 'Pick who owns them.' };
      const person = await prisma.user.findUnique({ where: { id: d.ownerId }, select: { name: true } });
      if (!person) return { error: 'That person no longer exists.' };
      const r = await prisma.lead.updateMany({ where, data: { ownerId: d.ownerId } });
      changed = r.count; what = `owner → ${person.name}`;
      await notifyMany([d.ownerId], {
        type: 'SYSTEM', title: `${changed} enquir${changed === 1 ? 'y' : 'ies'} moved to you`, link: '/sales',
      });
    } else if (d.action === 'temperature') {
      if (!d.temperature) return { error: 'Pick hot, warm or cold.' };
      const r = await prisma.lead.updateMany({ where, data: { temperature: d.temperature } });
      changed = r.count; what = `marked ${d.temperature.toLowerCase()}`;
    } else {
      await ensure('lead.delete');
      const r = await prisma.lead.updateMany({ where, data: { deletedAt: new Date() } });
      changed = r.count; what = 'deleted';
    }

    await writeAudit({
      actorId: ctx.user.id, action: 'UPDATE', entityType: 'Lead',
      summary: `Bulk: ${changed} lead${changed === 1 ? '' : 's'} — ${what}`,
    });
    revalidatePath('/sales');
    return { ok: true, changed, message: `${changed} enquir${changed === 1 ? 'y' : 'ies'} updated — ${what}.` };
  } catch (e) {
    return toActionError(e);
  }
}
