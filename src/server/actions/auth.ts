'use server';
import { z } from 'zod';
import { escapeHtml } from '@/lib/email/escape';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db/prisma';
import { authenticate, markLoginSuccess } from '@/server/services/auth-service';
import { createSession, destroySession, markTrustedDevice } from '@/lib/auth/session';
import { issueMfaTicket, readMfaTicket, clearMfaTicket } from '@/lib/auth/mfa-ticket';
import { openSecret, verifyTotpOnce, verifyBackupCode } from '@/lib/auth/totp';
import { getCurrentUser } from '@/lib/auth/current-user';
import { getSecurityPolicy, countryAllowed } from '@/lib/auth/policy';
import { requestCountry, requestCity, countryName } from '@/lib/auth/geo';
import { isKnownDevice, beginDeviceApproval, alertNewSignIn } from '@/lib/auth/device';
import { getClientInfo } from '@/lib/auth/session';
import { writeAudit } from '@/lib/audit/log';
import { checkRate, callerIp } from '@/lib/security/rate-limit';
import { createHash, randomBytes, randomInt } from 'node:crypto';
import { sendEmail } from '@/lib/email/email';

const loginSchema = z.object({
  identifier: z.string().min(1, 'Username or email is required'),
  password: z.string().min(1, 'Password is required'),
});

export type ActionState = { error?: string; ok?: boolean; success?: string };

/**
 * AMH-055 — the gates that stand between a correct credential and a session.
 *
 * These used to live inside `loginAction`'s `case 'ok'` branch, which meant
 * they applied to exactly one of the three ways into this application. A user
 * with two-factor on took `case 'needs_2fa'`, which redirected to /two-factor
 * before any of this ran, and `verifyTwoFactorAction` then called
 * `createSession` directly. So turning 2FA ON silently switched OFF:
 *
 *   - the allowed-countries perimeter (an India-only account could be opened
 *     from anywhere),
 *   - device approval (no six-digit code to the victim's own mailbox), and
 *   - the new-device alert — the only out-of-band signal the victim would ever
 *     have got that somebody else had signed in as them.
 *
 * Which is backwards: the extra factor removed two independent controls and
 * the warning. The SAML callback already ran them in this order; the password
 * path had drifted.
 *
 * One function, called from every path that mints a session, so the next path
 * added inherits them instead of forgetting them. Returns an ActionState on
 * refusal; otherwise it redirects and never returns.
 */
type LoginUser = { id: string; name: string; email: string; role: string; allowForeignAccess?: boolean };

/**
 * The gates that decide whether a credential is accepted AT ALL — where from,
 * and on what machine.
 *
 * AMH-067 — these run BEFORE the second factor, not after.
 *
 * They used to run after, inside `finishLogin`, which produced a genuinely
 * silly sign-in for a 2FA user on a new laptop: enter the authenticator code,
 * get bounced to /device-check, read the emailed code, and then be asked for a
 * SECOND authenticator code — because `verifyTotpOnce` had already burned the
 * first one, so they also had to wait for the next 30-second window. Three
 * codes for one sign-in.
 *
 * Running them first also matches the SAML callback, which has always been
 * ordered geo → device → 2FA → session. With the AMH-056 guard in
 * `verifyDeviceAction` handing back to /two-factor, device-before-2FA is now
 * the safe order everywhere.
 *
 * Returns an ActionState to refuse, redirects to /device-check, or returns
 * null to let the caller carry on.
 */
async function runEntryGates(user: LoginUser): Promise<ActionState | null> {
  const policy = await getSecurityPolicy();
  const country = await requestCountry();

  // Where from. An unknown country is never treated as a refusal.
  if (!countryAllowed(country, user, policy)) {
    await writeAudit({
      actorId: user.id, action: 'LOGIN_FAILED',
      summary: `Refused — sign-in from ${countryName(country)}, outside the allowed countries`,
    });
    return { error: `Sign-in from ${countryName(country)} is not permitted. Ask an administrator to allow access from outside India for your account.` };
  }

  // A device nobody has approved does not get a session, password or not.
  if (policy.deviceApproval && !(await isKnownDevice(user.id))) {
    const approval = await beginDeviceApproval(user);
    await writeAudit({
      actorId: user.id, action: 'LOGIN_FAILED',
      summary: approval.emailed
        ? `Device approval required — code emailed (${countryName(country)})`
        : `Device approval required but the email FAILED to send: ${approval.error}`,
    });
    redirect(`/device-check?t=${approval.token}${approval.emailed ? '' : '&sendfailed=1'}`);
  }

  return null;
}

/**
 * Mint the session, and only then record that anyone signed in.
 *
 * AMH-067 — `markLoginSuccess` and `clearMfaTicket` used to run in
 * `verifyTwoFactorAction` BEFORE the gates had spoken, so a login that was then
 * refused on country or device still left a `success: true` row in
 * `loginHistory` beside a `LOGIN_FAILED` audit line. Anyone reading the login
 * history to answer "did somebody get in from Dubai?" was reading a yes for a
 * session that never existed.
 *
 * Never returns — it always redirects.
 */
async function completeLogin(user: LoginUser, reason: string, opts?: { username?: string; historyReason?: string }): Promise<ActionState> {
  const policy = await getSecurityPolicy();
  const country = await requestCountry();
  // Recomputed here rather than threaded from runEntryGates: between the two
  // the user may have completed device approval, which trusts the machine. A
  // person who has just typed a code we emailed them does not also need an
  // email telling them somebody signed in.
  const known = await isKnownDevice(user.id);

  await createSession(user.id);
  if (opts?.username) await markLoginSuccess(user.id, opts.username, opts.historyReason ?? 'password');
  await prisma.user.update({ where: { id: user.id }, data: { lastCountry: country ?? undefined } }).catch(() => undefined);
  await writeAudit({ actorId: user.id, action: 'LOGIN', summary: `${reason} from ${countryName(country)}` });

  if (policy.alertNewDevice && !known) {
    const info = await getClientInfo();
    await alertNewSignIn(user, { country, city: await requestCity(), ip: info.ip, ua: info.userAgent });
  }

  // Guests belong on the sealed preview, never the workspace home.
  if (user.role === 'GUEST') redirect('/demo');
  // Always land people on their home screen. If two-factor still needs setting
  // up, that is surfaced as a prominent reminder on the home page — not a
  // forced detour that hides the whole CRM behind the security screen.
  redirect('/home');
}

/** Both gates then the session, for the paths that have no second factor. */
async function finishLogin(user: LoginUser, reason: string): Promise<ActionState> {
  const refused = await runEntryGates(user);
  if (refused) return refused;
  return completeLogin(user, reason);
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: 'Please enter your username/email and password.' };

  // Two buckets: one per address, one per account. The first blunts a flood
  // from a single machine; the second stops one password being tried against
  // many accounts from many machines.
  const ip = await callerIp();
  const byIp = await checkRate(`login:ip:${ip}`, 20, 300, true);
  const byUser = await checkRate(`login:user:${parsed.data.identifier.toLowerCase()}`, 10, 300, true);
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
      return { error: 'Too many failed attempts for this account. Please try again later.' }; // F-22: do not leak the exact unlock time
    case 'needs_2fa': {
      // AMH-067 — geo and device first, so the second factor is asked for once.
      const refused = await runEntryGates(result.user);
      if (refused) return refused;
      await issueMfaTicket(result.user.id);
      redirect('/two-factor');
    }
    case 'ok':
      return finishLogin(result.user, 'Password login');
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

  // F-06: throttle the second factor. Without this a stolen password + reusable
  // MFA ticket allows unlimited code guessing (TOTP window, emailed code, backup).
  const ip = await callerIp();
  const gate2fa = await checkRate(`2fa:verify:${userId}`, 6, 300, true);
  const gate2faIp = await checkRate(`2fa:verify:ip:${ip}`, 30, 300, true);
  if (!gate2fa.allowed || !gate2faIp.allowed) {
    return { error: 'Too many verification attempts. Please sign in again.' };
  }

  const parsed = twoFactorSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: 'Enter the 6-digit code from your authenticator app.' };

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.twoFactorSecret) return { error: 'Two-factor is not configured.' };

  const code = parsed.data.code.trim();
  // AMH-053 — verifyTotpOnce burns the time-step, so a code that leaks (screen
  // share, shoulder, phishing proxy) cannot be replayed for the rest of its
  // ~90-second window by whoever also has the password.
  let verified = await verifyTotpOnce(userId, code, openSecret(user.twoFactorSecret));

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
  if (parsed.data.trustDevice === 'on') await markTrustedDevice(user.id);

  // AMH-055 / AMH-067 — the country and device gates already ran in
  // `loginAction` before the MFA ticket was issued, and a ticket is the only
  // way to reach this function, so they cannot be skipped by coming here
  // directly. What is left is the part that must happen exactly once a session
  // really exists: create it, record the success, alert if the machine is new.
  return completeLogin(user, 'Password + 2FA login', { username: user.username, historyReason: '2fa' });
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

  const gate = await checkRate(`mfa:email:${userId}`, 5, 900, true);
  if (!gate.allowed) return { error: 'Too many codes requested. Please wait fifteen minutes.' };

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true } });
  if (!user) return { error: 'Please sign in again.' };

  const code = String(randomInt(100000, 1000000)); // F-06: CSPRNG, not Math.random
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
      `<p>Hello ${escapeHtml(user.name)},</p>` +
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
