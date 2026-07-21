import 'server-only';
import type { NotificationType } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';

export interface NotifyInput {
  type?: NotificationType;
  title: string;
  body?: string | null;
  link?: string | null;
}

/**
 * Create in-app notifications for a set of people. Guarded: notifying is a
 * *helper* to the action that triggered it, so if it fails it must never break
 * that action — it logs and moves on. De-duplicates the recipient list and
 * skips an empty one.
 */
export async function notifyUsers(userIds: Array<string | null | undefined>, input: NotifyInput): Promise<void> {
  try {
    const ids = [...new Set(userIds.filter((x): x is string => Boolean(x)))];
    if (ids.length === 0) return;
    await prisma.notification.createMany({
      data: ids.map((userId) => ({
        userId,
        type: input.type ?? 'SYSTEM',
        title: input.title,
        body: input.body ?? null,
        link: input.link ?? null,
      })),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[notify] failed to create notifications:', err instanceof Error ? err.message : err);
  }
}

/** Notify everyone who belongs to a department (main or extra), optionally excluding one person. */
export async function notifyDepartment(departmentId: string | null, input: NotifyInput, excludeUserId?: string | null): Promise<void> {
  if (!departmentId) return;
  try {
    const [main, extra] = await Promise.all([
      prisma.user.findMany({ where: { departmentId, status: 'ACTIVE' }, select: { id: true } }),
      prisma.departmentMember.findMany({ where: { departmentId }, select: { userId: true } }),
    ]);
    const ids = [...main.map((u) => u.id), ...extra.map((m) => m.userId)].filter((id) => id !== excludeUserId);
    await notifyUsers(ids, input);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[notify] failed to resolve department members:', err instanceof Error ? err.message : err);
  }
}
