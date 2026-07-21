import 'server-only';
import { fetchWithTimeout } from '@/lib/utils/fetch-timeout';
import { addDays, startOfDay, differenceInHours, formatDistanceToNowStrict } from 'date-fns';
import { prisma } from '@/lib/db/prisma';
import { env } from '@/config/env';
import { notify } from '@/lib/notifications/notify';
import { sendEmail } from '@/lib/email/email';
import { getWorkItems } from '@/server/services/workload-service';

/**
 * How often each channel may fire for the same overdue item.
 *
 * Email is every two hours: often enough that overdue work cannot be quietly
 * ignored for a day, and still spaced enough that it does not become noise
 * people filter away. Push stays hourly, WhatsApp every six.
 */
export const CADENCE = { pushHours: 1, emailHours: 2, whatsappHours: 6 };

export interface EscalationResult {
  overdue: number;
  pushed: number;
  emailed: number;
  whatsappQueued: number;
  resolved: number;
}

const appUrl = () => env.APP_URL.replace(/\/$/, '');

function due(last: Date | null | undefined, hours: number, now: Date): boolean {
  return !last || differenceInHours(now, last) >= hours;
}

/**
 * Find everything past its date, then nudge the person who owns it — hourly by
 * push, every two hours by email. Safe to call as often as you like: the
 * cadence is enforced per item from the timestamps, not from how often this
 * runs. Anything no longer overdue is closed off and stops nagging.
 */
export async function runOverdueEscalation(now = new Date()): Promise<EscalationResult> {
  const res: EscalationResult = { overdue: 0, pushed: 0, emailed: 0, whatsappQueued: 0, resolved: 0 };

  const items = await getWorkItems({ from: addDays(now, -180), to: now });
  const overdue = items.filter((i) => new Date(i.due) < startOfDay(now) || new Date(i.due) < now).filter((i) => i.ownerId);
  res.overdue = overdue.length;

  const liveKeys = new Set(overdue.map((i) => `${i.id}::${i.ownerId}`));

  // Close anything that is no longer overdue — done, reassigned or deleted.
  const open = await prisma.overdueNotice.findMany({ where: { resolvedAt: null }, select: { id: true, itemKey: true, userId: true } });
  const stale = open.filter((n) => !liveKeys.has(`${n.itemKey}::${n.userId}`));
  if (stale.length) {
    await prisma.overdueNotice.updateMany({ where: { id: { in: stale.map((s) => s.id) } }, data: { resolvedAt: now } });
    res.resolved = stale.length;
  }

  const users = await prisma.user.findMany({
    where: { status: 'ACTIVE', deletedAt: null },
    select: { id: true, name: true, email: true, whatsappNumber: true },
  });
  const userOf = new Map(users.map((u) => [u.id, u]));

  for (const item of overdue) {
    const user = userOf.get(item.ownerId!);
    if (!user) continue;

    const notice = await prisma.overdueNotice.upsert({
      where: { itemKey_userId: { itemKey: item.id, userId: user.id } },
      update: { title: item.title, dueAt: new Date(item.due), href: item.href, kind: item.kind, resolvedAt: null },
      create: { itemKey: item.id, userId: user.id, kind: item.kind, title: item.title, dueAt: new Date(item.due), href: item.href },
    });

    if (notice.snoozedUntil && notice.snoozedUntil > now) continue;

    const lateBy = formatDistanceToNowStrict(new Date(item.due));

    // Hourly: in-app + web push (PWA and the Android build both receive these).
    if (due(notice.lastPushAt, CADENCE.pushHours, now)) {
      await notify({
        userId: user.id, type: 'DEADLINE',
        title: `Overdue: ${item.title}`,
        body: `This was due ${lateBy} ago. Please close it or move the date.`,
        link: item.href,
      });
      await prisma.overdueNotice.update({
        where: { id: notice.id },
        data: { lastPushAt: now, pushCount: { increment: 1 } },
      });
      res.pushed++;
    }

    // Every two hours: email.
    if (due(notice.lastEmailAt, CADENCE.emailHours, now)) {
      const sent = await sendEmail({
        to: [user.email],
        subject: `Overdue: ${item.title}`,
        text: [
          `Hello ${user.name},`, '',
          `"${item.title}" was due ${lateBy} ago and is still open.`,
          item.detail ? `Reference: ${item.detail}` : '',
          '', `Open it here: ${appUrl()}${item.href}`,
          '', 'If the date has moved, update it in the CRM and these reminders stop.',
          '', '— Ameya Heights CRM',
        ].filter(Boolean).join('\n'),
      });
      if (sent.ok) {
        await prisma.overdueNotice.update({
          where: { id: notice.id },
          data: { lastEmailAt: now, emailCount: { increment: 1 } },
        });
        res.emailed++;
      }
    }

    // Every six hours: queue for WhatsApp. Sending needs a provider (see below);
    // until then these appear as one-tap links on the escalations screen.
    if (user.whatsappNumber && due(notice.lastWhatsappAt, CADENCE.whatsappHours, now)) {
      const delivered = await sendWhatsapp(user.whatsappNumber, `Reminder: "${item.title}" was due ${lateBy} ago. Open: ${appUrl()}${item.href}`);
      await prisma.overdueNotice.update({
        where: { id: notice.id },
        data: delivered ? { lastWhatsappAt: now, whatsappQueued: false } : { whatsappQueued: true },
      });
      res.whatsappQueued++;
    }
  }

  return res;
}

/**
 * Send a WhatsApp message through whatever gateway is configured.
 *
 * There is no free automatic path: personal WhatsApp has no API, and every
 * provider (Meta Cloud API, AiSensy, WATI, Twilio) needs an account. Set
 * WHATSAPP_WEBHOOK_URL to a gateway that accepts { to, message } and this
 * starts working with no further code. Until then it returns false and the
 * message is offered as a one-tap link instead.
 */
export async function sendWhatsapp(to: string, message: string): Promise<boolean> {
  // Preferred path: the connected WhatsApp Business account.
  try {
    const { sendWhatsappText, getWhatsappConnection } = await import('@/server/services/whatsapp-service');
    if (await getWhatsappConnection()) {
      const r = await sendWhatsappText(to, message);
      if (r.ok) return true;
    }
  } catch {
    // fall through to a gateway if one is configured
  }

  const url = process.env.WHATSAPP_WEBHOOK_URL;
  if (!url) return false;
  try {
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.WHATSAPP_WEBHOOK_TOKEN ? { Authorization: `Bearer ${process.env.WHATSAPP_WEBHOOK_TOKEN}` } : {}),
      },
      body: JSON.stringify({ to, message }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
