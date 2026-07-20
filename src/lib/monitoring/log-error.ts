import 'server-only';
import { createHash } from 'node:crypto';
import { prisma } from '@/lib/db/prisma';
import { sendEmail } from '@/lib/email/email';
import { env } from '@/config/env';

/**
 * Record an error once, count repeats, and email the admins the first time a
 * new one appears. Deliberately dependency-free — no Sentry account, no card,
 * no extra package to break the build.
 */
export async function logError(err: unknown, ctx?: { path?: string; userId?: string }): Promise<void> {
  try {
    const message = (err instanceof Error ? err.message : String(err)).slice(0, 500);
    const stack = err instanceof Error ? (err.stack ?? '').slice(0, 4000) : null;
    // Group by message + first stack frame, so the same bug is one row.
    const frame = stack?.split('\n')[1]?.trim() ?? '';
    const fingerprint = createHash('sha1').update(`${message}|${frame}|${ctx?.path ?? ''}`).digest('hex');

    const existing = await prisma.errorLog.findUnique({ where: { fingerprint } });
    if (existing) {
      await prisma.errorLog.update({
        where: { fingerprint },
        data: { count: { increment: 1 }, lastSeenAt: new Date(), resolvedAt: null },
      });
      return;
    }

    await prisma.errorLog.create({
      data: { fingerprint, message, stack, path: ctx?.path ?? null, userId: ctx?.userId ?? null },
    });

    // First sighting — tell someone.
    const admins = await prisma.user.findMany({
      where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] }, status: 'ACTIVE', deletedAt: null },
      select: { email: true },
    });
    if (admins.length) {
      await sendEmail({
        to: admins.map((a) => a.email),
        subject: `CRM error: ${message.slice(0, 80)}`,
        text: [
          'A new error occurred in the Ameya Heights CRM.', '',
          `Message: ${message}`,
          ctx?.path ? `Page: ${ctx.path}` : '',
          '', 'Details:', `${env.APP_URL.replace(/\/$/, '')}/admin/errors`,
          '', stack ? stack.slice(0, 1200) : '',
        ].filter(Boolean).join('\n'),
      });
      await prisma.errorLog.update({ where: { fingerprint }, data: { notifiedAt: new Date() } });
    }
  } catch {
    /* logging must never throw — that would mask the original problem */
  }
}
