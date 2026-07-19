'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from './_helpers';

export type AutoResult = { ok: true; id: string } | { error: string };

const ruleSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(500).optional(),
  trigger: z.enum(['LEAD_CREATED', 'LEAD_STAGE_CHANGED', 'TASK_CREATED', 'TASK_STATUS_CHANGED', 'SCHEDULE']),
  isActive: z.boolean().default(true),
  conditions: z.array(z.object({ field: z.string(), op: z.string(), value: z.string() })).default([]),
  actions: z.array(z.object({ type: z.string(), params: z.record(z.any()) })).min(1, 'Add at least one action'),
});

export async function createAutomationRule(input: unknown): Promise<AutoResult> {
  try {
    const ctx = await ensure('admin.setting.manage');
    const d = ruleSchema.parse(input);
    const rule = await prisma.automationRule.create({
      data: { name: d.name, description: d.description || null, trigger: d.trigger, isActive: d.isActive, conditions: d.conditions, actions: d.actions, createdById: ctx.user.id },
    });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'AutomationRule', entityId: rule.id, summary: `Created automation "${d.name}"` });
    revalidatePath('/admin/automations');
    return { ok: true, id: rule.id };
  } catch (err) { return toActionError(err); }
}

export async function updateAutomationRule(id: string, input: unknown): Promise<AutoResult> {
  try {
    const ctx = await ensure('admin.setting.manage');
    const d = ruleSchema.parse(input);
    await prisma.automationRule.update({ where: { id }, data: { name: d.name, description: d.description || null, trigger: d.trigger, isActive: d.isActive, conditions: d.conditions, actions: d.actions } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'AutomationRule', entityId: id, summary: `Edited automation "${d.name}"` });
    revalidatePath('/admin/automations');
    return { ok: true, id };
  } catch (err) { return toActionError(err); }
}

export async function toggleAutomationRule(id: string, isActive: boolean): Promise<AutoResult> {
  try {
    const ctx = await ensure('admin.setting.manage');
    await prisma.automationRule.update({ where: { id }, data: { isActive } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'AutomationRule', entityId: id, summary: isActive ? 'Enabled' : 'Disabled' });
    revalidatePath('/admin/automations');
    return { ok: true, id };
  } catch (err) { return toActionError(err); }
}

export async function deleteAutomationRule(id: string): Promise<AutoResult> {
  try {
    const ctx = await ensure('admin.setting.manage');
    await prisma.automationRule.delete({ where: { id } });
    await writeAudit({ actorId: ctx.user.id, action: 'DELETE', entityType: 'AutomationRule', entityId: id });
    revalidatePath('/admin/automations');
    return { ok: true, id };
  } catch (err) { return toActionError(err); }
}
