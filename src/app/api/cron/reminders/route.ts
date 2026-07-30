import { NextResponse, type NextRequest } from 'next/server';
import { requireBearerSecret } from '@/lib/security/require-secret';
import { prisma } from '@/lib/db/prisma';
import { env } from '@/config/env';
import { notify } from '@/lib/notifications/notify';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Fires due reminders as in-app/push notifications. Auth: CRON_SECRET. */
export async function GET(req: NextRequest) {
    const denied = requireBearerSecret(req, env.CRON_SECRET);
  if (denied) return denied;

  const due = await prisma.reminder.findMany({ where: { status: 'PENDING', notifiedAt: null, dueAt: { lte: new Date() } }, take: 500 });
  let sent = 0;
  for (const r of due) {
    try {
      await notify({ userId: r.userId, type: 'SYSTEM', title: `Reminder: ${r.title}`, body: r.notes ?? undefined, link: r.leadId ? `/sales/${r.leadId}` : '/reminders' });
      await prisma.reminder.update({ where: { id: r.id }, data: { notifiedAt: new Date() } });
      sent++;
    } catch { /* keep going */ }
  }
  return NextResponse.json({ ok: true, due: due.length, sent, at: new Date().toISOString() });
}
