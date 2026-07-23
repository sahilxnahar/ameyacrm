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
import { createHash, randomBytes } from 'node:crypto';
import { sendEmail } from '@/lib/email/email';

const loginSchema = z.object({
  identifier: z.string().min(1, 'Username or email is required'),
  password: z.string().min(1, 'Password is required'),
});

export type ActionState = { error?: string; ok?: boolean; success?: string };

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
        const approval = await beginDeviceApproval(result.user);
        await writeAudit({
          actorId: result.user.id, action: 'LOGIN_FAILED',
          summary: approval.emailed
            ? `Device approval required — code emailed (${countryName(country)})`
            : `Device approval required but the email FAILED to send: ${approval.error}`,
        });
        redirect(`/device-check?t=${approval.token}${approval.emailed ? '' : '&sendfailed=1'}`);
      }

      await createSession(result.user.id);
      await prisma.user.update({ where: { id: result.user.id }, data: { lastCountry: country ?? undefined } }).catch(() => undefined);
      await writeAudit({ actorId: result.user.id, action: 'LOGIN', summary: `Password login from ${countryName(country)}` });

      if (policy.alertNewDevice && !known) {
        const info = await getClientInfo();
        await alertNewSignIn(result.user, { country, city: await requestCity(), ip: info.ip, ua: info.userAgent });
      }

      // Land people on their home screen. A password that ought to be changed
      // is surfaced as a dismissible reminder there, not a forced detour.
      if (mustEnroll2FA(result.user, policy)) redirect('/settings/security?enroll=1');
      redirect('/home');
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

  // Fallback: a code we emailed, for when the phone is not to hand.
  if (!verified) verified = await verifyEmailSignInCode(userId, code);

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
    return { error: 'Incorrect code. Try again, use a backup code, or have one emailed to you.' };
  }

  await clearMfaTicket();
  await createSession(user.id);
  if (parsed.data.trustDevice === 'on') await markTrustedDevice(user.id);
  await markLoginSuccess(user.id, user.username, '2fa');
  await writeAudit({ actorId: user.id, action: 'LOGIN', summary: 'Password + 2FA login' });
  redirect('/home');
  // (user has 2FA here, so no enrollment gate needed)
}

/**
 * Sign out.
 *
 * The order matters and every step is defensive. Signing out used to begin by
 * reading the user and writing an audit entry — so when either of those threw
 * (a database that had fallen behind the code was enough), the action aborted
 * before it reached the line that clears the cookie, and the person simply
 * stayed logged in with no error to explain it. Ending the session is the one
 * thing that must always happen, so it goes first and nothing after it can
 * stop it.
 */
export async function logoutAction(): Promise<void> {
  const ctx = await getCurrentUser().catch(() => null);
  await destroySession().catch(() => undefined);
  if (ctx) await writeAudit({ actorId: ctx.user.id, action: 'LOGOUT' }).catch(() => undefined);
  redirect('/login');
}

/**
 * Send a one-time code by email as an alternative to the authenticator app.
 *
 * Only reachable after the password is already correct, so it never becomes a
 * way in on its own — it is a second factor, not a first. It exists because
 * phones get replaced, reset and left at home, and the alternative to this is
 * a support call and an administrator turning 2FA off entirely.
 */
export async function sendEmailSignInCodeAction(): Promise<ActionState> {
  const userId = await readMfaTicket();
  if (!userId) return { error: 'Your verification session expired. Please sign in again.' };

  const gate = await checkRate(`mfa:email:${userId}`, 5, 900);
  if (!gate.allowed) return { error: 'Too many codes requested. Please wait fifteen minutes.' };

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true } });
  if (!user) return { error: 'Please sign in again.' };

  const code = String(Math.floor(100000 + Math.random() * 900000));
  await prisma.deviceApproval.create({
    data: {
      userId: user.id,
      token: `mfa_${randomBytes(16).toString('hex')}`,
      codeHash: createHash('sha256').update(code).digest('hex'),
      deviceHash: 'email-code',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });

  const sent = await sendEmail({
    to: [user.email],
    subject: `${code} is your Ameya Heights sign-in code`,
    text: `Your Ameya Heights sign-in code is ${code}. It expires in ten minutes and can be used once.`,
    html:
      `<p>Hello ${user.name ?? ''},</p>` +
      `<p>Your sign-in code is <strong style="font-size:22px;letter-spacing:3px">${code}</strong></p>` +
      `<p>It expires in ten minutes and can be used once. If you did not try to sign in, change your password.</p>` +
      `<p>— Ameya Heights CRM</p>`,
  });
  if (!sent.ok) return { error: `The code could not be sent: ${sent.error ?? 'unknown email error'}` };

  return { success: `A six-digit code has been sent to ${user.email.replace(/^(.).*(@.*)$/, '$1•••$2')}.` };
}

/** Check a code that was emailed rather than generated by the authenticator app. */
async function verifyEmailSignInCode(userId: string, code: string): Promise<boolean> {
  const hash = createHash('sha256').update(code).digest('hex');
  const row = await prisma.deviceApproval.findFirst({
    where: {
      userId, deviceHash: 'email-code', codeHash: hash,
      usedAt: null, expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });
  if (!row) return false;
  await prisma.deviceApproval.update({ where: { id: row.id }, data: { usedAt: new Date() } });
  return true;
}
