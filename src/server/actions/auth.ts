'use server';
import { z } from 'zod';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db/prisma';
import { authenticate, markLoginSuccess } from '@/server/services/auth-service';
import { createSession, destroySession, markTrustedDevice } from '@/lib/auth/session';
import { issueMfaTicket, readMfaTicket, clearMfaTicket } from '@/lib/auth/mfa-ticket';
import { openSecret, verifyTotp, verifyBackupCode } from '@/lib/auth/totp';
import { getCurrentUser } from '@/lib/auth/current-user';
import { getSecurityPolicy, mustEnroll2FA, countryAllowed } from '@/lib/auth/policy';
import { requestCountry, requestCity, countryName } from '@/lib/auth/geo';
import { isKnownDevice, beginDeviceApproval, alertNewSignIn } from '@/lib/auth/device';
import { getClientInfo } from '@/lib/auth/session';
import { writeAudit } from '@/lib/audit/log';
import { checkRate, callerIp } from '@/lib/security/rate-limit';

const loginSchema = z.object({
  identifier: z.string().min(1, 'Username or email is required'),
  password: z.string().min(1, 'Password is required'),
});

export type ActionState = { error?: string; ok?: boolean };

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: 'Please enter your username/email and password.' };

  // Two buckets: one per address, one per account. The first blunts a flood
  // from a single machine; the second stops one password being tried against
  // many accounts from many machines.
  const ip = await callerIp();
  const byIp = await checkRate(`login:ip:${ip}`, 20, 300);
  const byUser = await checkRate(`login:user:${parsed.data.identifier.toLowerCase()}`, 10, 300);
  if (!byIp.allowed || !byUser.allowed) {
    await writeAudit({ action: 'LOGIN_FAILED', summary: `Rate limited from ${ip}` }).catch(() => undefined);
    return { error: 'Too many attempts. Please wait a few minutes and try again.' };
  }

  const result = await authenticate(parsed.data.identifier, parsed.data.password);

  switch (result.status) {
    case 'invalid':
      return { error: 'Invalid credentials. Please try again.' };
    case 'disabled':
      return { error: 'This account is disabled. Contact your administrator.' };
    case 'pending':
      return { error: 'This account is not active yet. Confirm your email, then wait for an administrator to approve access if you are outside the company domain.' };
    case 'locked':
      return { error: `Account locked. Try again after ${result.retryAt.toLocaleTimeString()}.` };
    case 'needs_2fa':
      await issueMfaTicket(result.user.id);
      redirect('/two-factor');
    case 'ok': {
      const policy = await getSecurityPolicy();
      const country = await requestCountry();

      // Where from. An unknown country is never treated as a refusal.
      if (!countryAllowed(country, result.user, policy)) {
        await writeAudit({
          actorId: result.user.id, action: 'LOGIN_FAILED',
          summary: `Refused — sign-in from ${countryName(country)}, outside the allowed countries`,
        });
        return { error: `Sign-in from ${countryName(country)} is not permitted. Ask an administrator to allow access from outside India for your account.` };
      }

      // A device nobody has approved does not get a session, password or not.
      const known = await isKnownDevice(result.user.id);
      if (policy.deviceApproval && !known) {
        const token = await beginDeviceApproval(result.user);
        await writeAudit({
          actorId: result.user.id, action: 'LOGIN_FAILED',
          summary: `Device approval required — code emailed (${countryName(country)})`,
        });
        redirect(`/device-check?t=${token}`);
      }

      await createSession(result.user.id);
      await prisma.user.update({ where: { id: result.user.id }, data: { lastCountry: country ?? undefined } }).catch(() => undefined);
      await writeAudit({ actorId: result.user.id, action: 'LOGIN', summary: `Password login from ${countryName(country)}` });

      if (policy.alertNewDevice && !known) {
        const info = await getClientInfo();
        await alertNewSignIn(result.user, { country, city: await requestCity(), ip: info.ip, ua: info.userAgent });
      }

      if (result.mustChangePassword) redirect('/settings/security?force=1');
      if (mustEnroll2FA(result.user, policy)) redirect('/settings/security?enroll=1');
      redirect('/dashboard');
    }
  }
  return { error: 'Unexpected error. Please try again.' };
}

const twoFactorSchema = z.object({
  code: z.string().min(6, 'Enter the 6-digit code'),
  trustDevice: z.string().optional(),
});

export async function verifyTwoFactorAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const userId = await readMfaTicket();
  if (!userId) return { error: 'Your verification session expired. Please sign in again.' };

  const parsed = twoFactorSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: 'Enter the 6-digit code from your authenticator app.' };

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.twoFactorSecret) return { error: 'Two-factor is not configured.' };

  const code = parsed.data.code.trim();
  let verified = verifyTotp(code, openSecret(user.twoFactorSecret));

  // Fallback: single-use backup code
  if (!verified) {
    const codes = await prisma.backupCode.findMany({ where: { userId, usedAt: null } });
    for (const bc of codes) {
      if (await verifyBackupCode(code, bc.codeHash)) {
        await prisma.backupCode.update({ where: { id: bc.id }, data: { usedAt: new Date() } });
        verified = true;
        break;
      }
    }
  }

  if (!verified) {
    await prisma.loginHistory.create({
      data: { userId, username: user.username, success: false, reason: '2fa_failed' },
    });
    return { error: 'Incorrect code. Try again or use a backup code.' };
  }

  await clearMfaTicket();
  await createSession(user.id);
  if (parsed.data.trustDevice === 'on') await markTrustedDevice(user.id);
  await markLoginSuccess(user.id, user.username, '2fa');
  await writeAudit({ actorId: user.id, action: 'LOGIN', summary: 'Password + 2FA login' });
  redirect(user.mustChangePassword ? '/settings/security?force=1' : '/dashboard');
  // (user has 2FA here, so no enrollment gate needed)
}

export async function logoutAction(): Promise<void> {
  const ctx = await getCurrentUser();
  if (ctx) await writeAudit({ actorId: ctx.user.id, action: 'LOGOUT' });
  await destroySession();
  redirect('/login');
}
