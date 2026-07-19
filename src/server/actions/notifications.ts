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
