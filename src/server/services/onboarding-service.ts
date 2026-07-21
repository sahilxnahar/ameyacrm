import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { env } from '@/config/env';
import { sendEmail } from '@/lib/email/email';
import { sha256, randomToken } from '@/lib/utils/crypto';

const appUrl = () => env.APP_URL.replace(/\/$/, '');

/**
 * How hard to chase someone who has not signed in.
 *
 * Hourly, as asked — but it stops after three days. An email arriving every
 * hour for a week stops being a reminder and starts being a reason to mark the
 * sender as spam, which would cost you every future CRM email to that person.
 */
export const ONBOARDING = {
  everyHours: 1,
  giveUpAfterHours: 72,
  linkValidDays: 7,
};

export interface OnboardingResult { checked: number; reminded: number; completed: number; gaveUp: number; failed: number }

/** Start the invite: one-time link, welcome email, and the nudge clock. */
export async function beginOnboarding(userId: string, createdById?: string): Promise<{ ok: boolean; error?: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, username: true, role: true },
  });
  if (!user?.email) return { ok: false, error: 'That person has no email address.' };

  const token = randomToken(32);
  const expires = new Date(Date.now() + ONBOARDING.linkValidDays * 864e5);

  await prisma.userOnboarding.upsert({
    where: { userId },
    update: {
      tokenHash: sha256(token), tokenExpires: expires, tokenUsedAt: null,
      welcomeSentAt: null, lastRemindAt: null, remindCount: 0,
      completedAt: null, stoppedReason: null, lastError: null,
    },
    create: { userId, tokenHash: sha256(token), tokenExpires: expires, createdById: createdById ?? null },
  });

  const sent = await sendWelcome(user, token);
  await prisma.userOnboarding.update({
    where: { userId },
    data: sent.ok ? { welcomeSentAt: new Date(), lastRemindAt: new Date() } : { lastError: sent.error ?? 'send failed' },
  });
  return sent;
}

async function sendWelcome(
  user: { name: string; email: string; username: string; role: string },
  token: string,
): Promise<{ ok: boolean; error?: string }> {
  const link = `${appUrl()}/set-password?token=${token}`;
  return sendEmail({
    to: [user.email],
    subject: 'Your Ameya Heights CRM account is ready',
    text: [
      `Hello ${user.name},`,
      '',
      'An account has been created for you on the Ameya Heights CRM.',
      '',
      `Sign in at: ${appUrl()}`,
      `Your username: ${user.username}`,
      '',
      'Set your own password using this link — it is private to you and nobody',
      'else knows what you choose:',
      link,
      '',
      `The link works for ${ONBOARDING.linkValidDays} days. After that ask an administrator to send a new one.`,
      '',
      'You can also install the CRM on your phone: open the sign-in page and',
      'choose "Add to Home Screen".',
      '',
      '— Ameya Heights CRM',
    ].join('\n'),
  });
}

/**
 * Nudge everyone who has not signed in yet. Called hourly by the same
 * scheduler that runs the overdue escalation, so no new trigger is needed.
 */
export async function runOnboardingReminders(now = new Date()): Promise<OnboardingResult> {
  const res: OnboardingResult = { checked: 0, reminded: 0, completed: 0, gaveUp: 0, failed: 0 };

  const pending = await prisma.userOnboarding.findMany({
    where: { completedAt: null },
    take: 200,
    select: {
      id: true, userId: true, lastRemindAt: true, remindCount: true, createdAt: true,
      tokenExpires: true, tokenUsedAt: true,
    },
  });
  res.checked = pending.length;
  if (!pending.length) return res;

  const users = await prisma.user.findMany({
    where: { id: { in: pending.map((p) => p.userId) } },
    select: { id: true, name: true, email: true, username: true, lastLoginAt: true, status: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));

  for (const row of pending) {
    const user = byId.get(row.userId);

    // Gone, disabled, or they have signed in — either way, stop.
    if (!user || user.status === 'DISABLED' || user.status === 'SUSPENDED') {
      await prisma.userOnboarding.update({ where: { id: row.id }, data: { completedAt: now, stoppedReason: 'the account is no longer active' } });
      res.completed++;
      continue;
    }
    if (user.lastLoginAt) {
      await prisma.userOnboarding.update({ where: { id: row.id }, data: { completedAt: now, stoppedReason: 'signed in' } });
      res.completed++;
      continue;
    }

    const ageHours = (now.getTime() - row.createdAt.getTime()) / 36e5;
    if (ageHours > ONBOARDING.giveUpAfterHours) {
      await prisma.userOnboarding.update({
        where: { id: row.id },
        data: { completedAt: now, stoppedReason: `no sign-in after ${Math.round(ageHours / 24)} days — chase them yourself` },
      });
      res.gaveUp++;
      continue;
    }

    const sinceLast = row.lastRemindAt ? (now.getTime() - row.lastRemindAt.getTime()) / 36e5 : 999;
    if (sinceLast < ONBOARDING.everyHours) continue;

    const expired = row.tokenExpires < now;
    const sent = await sendEmail({
      to: [user.email],
      subject: `Reminder: your CRM account is waiting (${user.username})`,
      text: [
        `Hello ${user.name},`,
        '',
        'Your Ameya Heights CRM account has been ready since',
        `${row.createdAt.toLocaleString('en-IN')}, but you have not signed in yet.`,
        '',
        `Sign in at: ${appUrl()}`,
        `Your username: ${user.username}`,
        '',
        expired
          ? 'Your set-password link has expired — ask an administrator to send a new one.'
          : 'If you have not set a password yet, use the link in your welcome email.',
        '',
        'These reminders stop as soon as you sign in.',
        '',
        '— Ameya Heights CRM',
      ].join('\n'),
    });

    if (sent.ok) {
      await prisma.userOnboarding.update({
        where: { id: row.id },
        data: { lastRemindAt: now, remindCount: { increment: 1 }, lastError: null },
      });
      res.reminded++;
    } else {
      await prisma.userOnboarding.update({ where: { id: row.id }, data: { lastRemindAt: now, lastError: sent.error ?? 'send failed' } });
      res.failed++;
    }
  }

  return res;
}

/** Exchange the emailed token for the user it belongs to. */
export async function resolveSetupToken(token: string): Promise<{ userId: string; name: string; username: string } | null> {
  if (!token) return null;
  const row = await prisma.userOnboarding.findUnique({
    where: { tokenHash: sha256(token) },
    select: { userId: true, tokenExpires: true, tokenUsedAt: true },
  });
  if (!row || row.tokenUsedAt || row.tokenExpires < new Date()) return null;
  const user = await prisma.user.findUnique({ where: { id: row.userId }, select: { id: true, name: true, username: true, status: true } });
  if (!user || user.status === 'DISABLED' || user.status === 'SUSPENDED') return null;
  return { userId: user.id, name: user.name, username: user.username };
}

/** Mark the invite finished once the password is set. */
export async function completeOnboarding(userId: string): Promise<void> {
  await prisma.userOnboarding.updateMany({
    where: { userId, completedAt: null },
    data: { tokenUsedAt: new Date(), completedAt: new Date(), stoppedReason: 'password set' },
  });
}
