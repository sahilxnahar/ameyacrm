'use server';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { WEBHOOK_EVENT_KEYS } from '@/lib/webhooks/events';
import { dispatchWebhookEvent } from '@/lib/webhooks/dispatch';
import { ensure, toActionError } from './_helpers';

export type WebhookResult = { ok: true; secret?: string } | { error: string };

const createSchema = z.object({
  url: z.string().url().max(500),
  events: z.array(z.enum(WEBHOOK_EVENT_KEYS as unknown as [string, ...string[]])).min(1),
  description: z.string().max(120).optional(),
});

/** Register a webhook. The signing secret is returned once for the receiver. */
export async function createWebhook(input: unknown): Promise<WebhookResult> {
  try {
    const ctx = await ensure('admin.setting.manage');
    const d = createSchema.parse(input);
    const secret = `whsec_${randomBytes(24).toString('hex')}`;
    const w = await prisma.webhook.create({
      data: { url: d.url, events: d.events, secret, description: d.description ?? null, createdById: ctx.user.id, source: 'manual' },
    });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'Webhook', entityId: w.id, summary: `Added webhook to ${d.url}` });
    revalidatePath('/admin/webhooks');
    return { ok: true, secret };
  } catch (err) { return toActionError(err); }
}

export async function toggleWebhook(id: string, isActive: boolean): Promise<WebhookResult> {
  try {
    const ctx = await ensure('admin.setting.manage');
    await prisma.webhook.update({ where: { id }, data: { isActive, ...(isActive ? { failureCount: 0, lastError: null } : {}) } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'Webhook', entityId: id, summary: `${isActive ? 'Enabled' : 'Disabled'} webhook` });
    revalidatePath('/admin/webhooks');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

export async function deleteWebhook(id: string): Promise<WebhookResult> {
  try {
    const ctx = await ensure('admin.setting.manage');
    await prisma.webhook.delete({ where: { id } });
    await writeAudit({ actorId: ctx.user.id, action: 'DELETE', entityType: 'Webhook', entityId: id, summary: 'Removed webhook' });
    revalidatePath('/admin/webhooks');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

/** Send a sample event so the receiver can confirm the endpoint and signature. */
export async function testWebhook(id: string): Promise<WebhookResult> {
  try {
    await ensure('admin.setting.manage');
    const w = await prisma.webhook.findUnique({ where: { id } });
    if (!w) return { error: 'Webhook not found.' };
    const evt = (w.events[0] as never) ?? ('lead.created' as never);
    await dispatchWebhookEvent(evt, { test: true, message: 'This is a test delivery from Ameya CRM.', id: 'test-000' });
    revalidatePath('/admin/webhooks');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}
