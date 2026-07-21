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
  // true = every condition must match, false = any one will do.
  matchAll: z.boolean().default(true),
  // `value` is optional: "has a value" and "is blank" do not take one, and
  // demanding it here rejected perfectly good rules before they reached the
  // engine.
  conditions: z.array(z.object({ field: z.string(), op: z.string(), value: z.string().optional() })).default([]),
  actions: z.array(z.object({ type: z.string(), params: z.record(z.any()) })).min(1, 'Add at least one action'),
});

export async function createAutomationRule(input: unknown): Promise<AutoResult> {
  try {
    const ctx = await ensure('admin.setting.manage');
    const d = ruleSchema.parse(input);
    const rule = await prisma.automationRule.create({
      data: { name: d.name, description: d.description || null, trigger: d.trigger, isActive: d.isActive, matchAll: d.matchAll, conditions: d.conditions, actions: d.actions, createdById: ctx.user.id },
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
    await prisma.automationRule.update({ where: { id }, data: { name: d.name, description: d.description || null, trigger: d.trigger, isActive: d.isActive, matchAll: d.matchAll, conditions: d.conditions, actions: d.actions } });
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

// ════════════════════════════════════════════════════════════════════════════
//  Describe it in words, and have the AI build it
// ════════════════════════════════════════════════════════════════════════════

export type DraftResult =
  | { ok: true; draft: import('@/lib/automation/sanitise').DraftAutomation }
  | { error: string };

/**
 * Turn a sentence into a draft automation.
 *
 * It deliberately stops at a draft. The rule is shown for approval and is not
 * saved, not switched on, and cannot do anything until somebody has read it.
 * An automation that assigns leads or emails buyers is not something to create
 * on the strength of one sentence and a hopeful model.
 */
export async function draftAutomation(request: string): Promise<DraftResult> {
  try {
    await ensure('admin.setting.manage');
    const text = request.trim();
    if (text.length < 8) return { error: 'Tell me a little more about what it should do.' };
    if (text.length > 600) return { error: 'That is rather long — try one automation at a time.' };

    const { draftAutomationFromWords } = await import('@/server/services/automation-ai-service');
    const draft = await draftAutomationFromWords(text);
    if ('error' in draft) return draft;
    return { ok: true, draft };
  } catch (e) {
    return toActionError(e);
  }
}
