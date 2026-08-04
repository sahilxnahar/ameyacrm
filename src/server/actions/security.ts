'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { breachVerdict } from '@/lib/auth/breach';
import { getSecurityPolicy } from '@/lib/auth/policy';
import { hashPassword, verifyPassword, validatePasswordStrength } from '@/lib/auth/password';
import {
  generateTotpSecret, sealSecret, openSecret, totpUri, totpQrDataUrl, verifyTotpOnce, generateBackupCodes,
} from '@/lib/auth/totp';
import { writeAudit } from '@/lib/audit/log';
import { getActionContext, toActionError } from './_helpers';

export type SecurityResult = { ok: true } | { error: string };

/**
 * Step 1 — generate a secret + QR. Secret is sealed and stored, 2FA stays OFF
 * until confirmed.
 *
 * AMH-052 — re-enrolling costs a password, exactly like disabling does.
 *
 * This used to need nothing but a session. That made replacing someone's
 * second factor EASIER than turning it off: anyone holding a hijacked session
 * cookie, or sitting at an unlocked desk, could start setup, point their own
 * authenticator at the new QR, confirm, and walk away owning the second factor
 * plus a fresh set of backup codes — never once knowing the password. And
 * because the secret was written at step 1, the victim's authenticator stopped
 * working the moment the attacker began, whether or not they finished.
 *
 * So: a user who has 2FA on must re-authenticate before the stored secret is
 * touched, and the write only happens after that check passes. First-time
 * enrolment is unchanged — there is no factor to steal yet.
 */
export async function startTwoFactorSetup(password?: string): Promise<{ qr: string; secret: string } | { error: string }> {
  try {
    const ctx = await getActionContext();
    const user = await prisma.user.findUnique({ where: { id: ctx.user.id } });
    if (!user) return { error: 'Your session expired. Please sign in again.' };

    // Only a CONFIRMED factor is worth protecting. A dangling secret from a
    // setup somebody abandoned protects nothing, and asking for a password to
    // retry it would just wedge them.
    if (user.twoFactorEnabled) {
      if (!password) return { error: 'PASSWORD_REQUIRED' };
      if (!(await verifyPassword(password, user.passwordHash))) {
        await writeAudit({
          actorId: user.id, action: 'TWO_FACTOR_RESET_REFUSED', entityType: 'User', entityId: user.id,
          summary: 'Wrong password given when re-enrolling a second factor',
        });
        return { error: 'Incorrect password.' };
      }
    }

    const secret = generateTotpSecret();
    await prisma.user.update({
      where: { id: ctx.user.id },
      // A new secret starts a new replay ledger; keeping the old step would
      // reject every code from the new authenticator until the clock caught up.
      data: { twoFactorSecret: sealSecret(secret), twoFactorLastStep: null },
    });
    const uri = totpUri(secret, ctx.user.email);
    return { qr: await totpQrDataUrl(uri), secret };
  } catch (err) {
    return toActionError(err);
  }
}

/** Step 2 — confirm a TOTP code, enable 2FA, and issue one-time backup codes. */
export async function confirmTwoFactor(code: string): Promise<{ ok: true; backupCodes: string[] } | { error: string }> {
  try {
    const ctx = await getActionContext();
    const user = await prisma.user.findUnique({ where: { id: ctx.user.id } });
    if (!user?.twoFactorSecret) return { error: 'Start setup first.' };
    // Burned, not merely checked: the enrolment code must not double as a
    // login code a few seconds later (AMH-053).
    if (!(await verifyTotpOnce(user.id, code, openSecret(user.twoFactorSecret)))) return { error: 'Incorrect code. Try again.' };

    const { codes, hashes } = await generateBackupCodes(10);
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: true } }),
      prisma.backupCode.deleteMany({ where: { userId: user.id } }),
      prisma.backupCode.createMany({ data: hashes.map((codeHash) => ({ userId: user.id, codeHash })) }),
    ]);
    await writeAudit({ actorId: user.id, action: 'TWO_FACTOR_ENABLED', entityType: 'User', entityId: user.id });
    revalidatePath('/settings/security');
    return { ok: true, backupCodes: codes };
  } catch (err) {
    return toActionError(err);
  }
}

export async function disableTwoFactor(password: string): Promise<SecurityResult> {
  try {
    const ctx = await getActionContext();
    const user = await prisma.user.findUnique({ where: { id: ctx.user.id } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) return { error: 'Incorrect password.' };
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorLastStep: null } }),
      prisma.backupCode.deleteMany({ where: { userId: user.id } }),
    ]);
    await writeAudit({ actorId: user.id, action: 'TWO_FACTOR_DISABLED', entityType: 'User', entityId: user.id });
    revalidatePath('/settings/security');
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}

const pwSchema = z.object({ current: z.string().min(1), next: z.string().min(12) });
export async function changePassword(input: unknown): Promise<SecurityResult> {
  try {
    const ctx = await getActionContext();
    const d = pwSchema.parse(input);
    const errs = validatePasswordStrength(d.next);
    const policy = await getSecurityPolicy();
    if (policy.breachCheck) {
      const breach = await breachVerdict(d.next);
      if (!breach.ok) return { error: breach.message ?? 'Please choose a different password.' };
    }
    if (errs.length) return { error: `Weak password: ${errs.join(', ')}` };

    const user = await prisma.user.findUnique({ where: { id: ctx.user.id } });
    if (!user || !(await verifyPassword(d.current, user.passwordHash))) return { error: 'Current password is incorrect.' };

    // Prevent reuse of the last 5 passwords.
    const history = await prisma.passwordHistory.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 5 });
    for (const h of history) if (await verifyPassword(d.next, h.passwordHash)) return { error: 'You cannot reuse a recent password.' };

    const newHash = await hashPassword(d.next);
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { passwordHash: newHash, passwordChangedAt: new Date(), mustChangePassword: false } }),
      prisma.passwordHistory.create({ data: { userId: user.id, passwordHash: user.passwordHash } }),
      // F-30: changing the password evicts every OTHER active session, so a
      // suspected-compromise password change actually logs the attacker out.
      prisma.session.updateMany({ where: { userId: user.id, revokedAt: null, id: { not: ctx.sessionId } }, data: { revokedAt: new Date() } }),
    ]);
    await writeAudit({ actorId: user.id, action: 'PASSWORD_CHANGE', entityType: 'User', entityId: user.id, summary: 'User changed password' });
    revalidatePath('/settings/security');
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}
