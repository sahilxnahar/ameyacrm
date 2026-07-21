'use server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { hashPassword, validatePasswordStrength } from '@/lib/auth/password';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from '@/server/actions/_helpers';
import { resolveSetupToken, completeOnboarding, beginOnboarding } from '@/server/services/onboarding-service';

export type SetupResult = { ok: true; username: string } | { error: string };

const schema = z.object({
  token: z.string().min(10),
  password: z.string().min(8, 'Use at least 8 characters.'),
  confirm: z.string(),
});

/** A new joiner sets their own password from the emailed link. No sign-in required. */
export async function setPasswordFromInvite(input: unknown): Promise<SetupResult> {
  try {
    const d = schema.parse(input);
    if (d.password !== d.confirm) return { error: 'The two passwords do not match.' };

    const errs = validatePasswordStrength(d.password);
    if (errs.length) return { error: errs.join(', ') };

    const who = await resolveSetupToken(d.token);
    if (!who) return { error: 'That link has expired or has already been used. Ask an administrator to send a new one.' };

    await prisma.user.update({
      where: { id: who.userId },
      data: {
        passwordHash: await hashPassword(d.password),
        mustChangePassword: false,
        passwordChangedAt: new Date(),
        status: 'ACTIVE',
      },
    });
    await completeOnboarding(who.userId);
    await writeAudit({ actorId: who.userId, action: 'UPDATE', entityType: 'User', entityId: who.userId, summary: 'Set their own password from the invite link' });
    return { ok: true, username: who.username };
  } catch (e) {
    return toActionError(e);
  }
}

export type ResendResult = { ok: true; message: string } | { error: string };

/** Send the welcome email again, with a fresh link. */
export async function resendInvite(userId: string): Promise<ResendResult> {
  try {
    const ctx = await ensure('admin.user.manage');
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true, lastLoginAt: true } });
    if (!user) return { error: 'That person no longer exists.' };
    if (user.lastLoginAt) return { error: `${user.name} has already signed in — there is nothing to resend.` };

    const r = await beginOnboarding(userId, ctx.user.id);
    if (!r.ok) return { error: r.error ?? 'The email could not be sent.' };
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'User', entityId: userId, summary: `Resent the invite to ${user.email}` });
    return { ok: true, message: `Sent again to ${user.email}. Hourly reminders restart from now.` };
  } catch (e) {
    return toActionError(e);
  }
}

/** Stop chasing someone without disabling their account. */
export async function stopInviteReminders(userId: string): Promise<ResendResult> {
  try {
    const ctx = await ensure('admin.user.manage');
    await prisma.userOnboarding.updateMany({
      where: { userId, completedAt: null },
      data: { completedAt: new Date(), stoppedReason: 'stopped by an admin' },
    });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'User', entityId: userId, summary: 'Stopped the invite reminders' });
    return { ok: true, message: 'Reminders stopped. They can still sign in normally.' };
  } catch (e) {
    return toActionError(e);
  }
}
