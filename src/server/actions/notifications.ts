'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import type { NotificationType, NotificationChannel } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { getActionContext, toActionError } from './_helpers';

export type NotifResult = { ok: true } | { error: string };

export async function saveNotificationPreference(type: NotificationType, channel: NotificationChannel, enabled: boolean): Promise<NotifResult> {
  try {
    const ctx = await getActionContext();
    await prisma.notificationPreference.upsert({
      where: { userId_type_channel: { userId: ctx.user.id, type, channel } },
      update: { enabled },
      create: { userId: ctx.user.id, type, channel, enabled },
    });
    revalidatePath('/settings/notifications');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

/** Mark one of your notifications read. Scoped to you, so you can't touch anyone else's. */
export async function markNotificationRead(id: string): Promise<NotifResult> {
  try {
    const ctx = await getActionContext();
    await prisma.notification.updateMany({ where: { id, userId: ctx.user.id, readAt: null }, data: { readAt: new Date() } });
    revalidatePath('/notifications');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

/** Mark all of your unread notifications read. */
export async function markAllNotificationsRead(): Promise<NotifResult> {
  try {
    const ctx = await getActionContext();
    await prisma.notification.updateMany({ where: { userId: ctx.user.id, readAt: null }, data: { readAt: new Date() } });
    revalidatePath('/notifications');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

const settingsSchema = z.object({
  dnd: z.boolean().default(false),
  quietStart: z.string().optional(), // "HH:MM"
  quietEnd: z.string().optional(),
  sound: z.boolean().default(true),
  vibrate: z.boolean().default(true),
});

export async function saveNotificationSettings(input: unknown): Promise<NotifResult> {
  try {
    const ctx = await getActionContext();
    const d = settingsSchema.parse(input);
    await prisma.setting.upsert({
      where: { key: `notifications.${ctx.user.id}` },
      update: { value: d },
      create: { key: `notifications.${ctx.user.id}`, value: d },
    });
    revalidatePath('/settings/notifications');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}
