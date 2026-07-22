import 'server-only';
import webpush from 'web-push';
import type { NotificationType } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { env } from '@/config/env';
import { publish } from '@/lib/realtime/realtime';

let vapidReady = false;
function ensureVapid(): boolean {
  if (vapidReady) return true;
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  vapidReady = true;
  return true;
}

interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
}


/** True when the user's Do-Not-Disturb or quiet-hours window suppresses EMAIL/PUSH. */
async function quietSuppressed(userId: string): Promise<boolean> {
  const row = await prisma.setting.findUnique({ where: { key: `notifications.${userId}` } });
  const v = (row?.value ?? null) as { dnd?: boolean; quietStart?: string; quietEnd?: string } | null;
  if (!v) return false;
  if (v.dnd) return true;
  if (v.quietStart && v.quietEnd) {
    const now = new Date();
    const cur = now.getHours() * 60 + now.getMinutes();
    const [sh, sm] = v.quietStart.split(':').map(Number);
    const [eh, em] = v.quietEnd.split(':').map(Number);
    const start = (sh ?? 0) * 60 + (sm ?? 0);
    const end = (eh ?? 0) * 60 + (em ?? 0);
    // Handles windows that cross midnight.
    return start <= end ? cur >= start && cur < end : cur >= start || cur < end;
  }
  return false;
}

async function channelEnabled(userId: string, type: NotificationType, channel: 'IN_APP' | 'PUSH') {
  const pref = await prisma.notificationPreference.findUnique({
    where: { userId_type_channel: { userId, type, channel } },
  });
  return pref?.enabled ?? true; // default on
}

/** Persist an in-app notification and fan out to web-push subscriptions. */
export async function notify({ userId, type, title, body, link }: NotifyInput): Promise<void> {
  if (await channelEnabled(userId, type, 'IN_APP')) {
    await prisma.notification.create({ data: { userId, type, title, body, link } });
    // Nudge this person's open tabs to refresh the bell instantly (no-op unless
    // a realtime service is configured).
    void publish(`user:${userId}`, 'notification', {});
  }

  if (ensureVapid() && (await channelEnabled(userId, type, 'PUSH')) && !(await quietSuppressed(userId))) {
    const subs = await prisma.pushSubscription.findMany({ where: { userId } });
    const payload = JSON.stringify({ title, body, url: link ?? '/dashboard' });
    await Promise.all(
      subs.map((s) =>
        webpush
          .sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload)
          .catch(async (err: { statusCode?: number }) => {
            if (err.statusCode === 404 || err.statusCode === 410) {
              await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
            }
          }),
      ),
    );
  }
}

export async function notifyMany(userIds: string[], input: Omit<NotifyInput, 'userId'>): Promise<void> {
  await Promise.all([...new Set(userIds)].map((userId) => notify({ userId, ...input })));
}
