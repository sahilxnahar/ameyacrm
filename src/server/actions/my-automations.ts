'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from './_helpers';
import { readMyAutomationPrefs } from '@/lib/automation/my-prefs';

export type MyAutoResult = { ok: true } | { error: string };

const prefSchema = z.object({
  key: z.string().min(1).max(80),
  on: z.boolean(),
  dueInDays: z.coerce.number().int().min(0).max(365).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
});

/** Save this user's personal choice for one automation (on/off + optional tweaks). */
export async function saveMyAutomation(input: unknown): Promise<MyAutoResult> {
  try {
    const ctx = await ensure('dashboard.view'); // any signed-in user may tailor their own
    const d = prefSchema.parse(input);
    const row = await prisma.user.findUnique({ where: { id: ctx.user.id }, select: { automationPrefs: true } });
    const current = readMyAutomationPrefs(row?.automationPrefs);
    current[d.key] = { on: d.on, ...(d.dueInDays != null ? { dueInDays: d.dueInDays } : {}), ...(d.priority ? { priority: d.priority } : {}) };
    await prisma.user.update({ where: { id: ctx.user.id }, data: { automationPrefs: current } });
    revalidatePath('/automations');
    return { ok: true };
  } catch (e) { return toActionError(e); }
}

/** Turn a whole department's automations on or off for this user in one go. */
export async function setMyAutomationsForKeys(keys: string[], on: boolean): Promise<MyAutoResult> {
  try {
    const ctx = await ensure('dashboard.view');
    const clean = z.array(z.string().max(80)).max(400).parse(keys);
    const row = await prisma.user.findUnique({ where: { id: ctx.user.id }, select: { automationPrefs: true } });
    const current = readMyAutomationPrefs(row?.automationPrefs);
    for (const k of clean) current[k] = { ...(current[k] ?? {}), on };
    await prisma.user.update({ where: { id: ctx.user.id }, data: { automationPrefs: current } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'UserAutomationPrefs', entityId: ctx.user.id, summary: `${on ? 'Enabled' : 'Disabled'} ${clean.length} personal automation(s)` });
    revalidatePath('/automations');
    return { ok: true };
  } catch (e) { return toActionError(e); }
}
