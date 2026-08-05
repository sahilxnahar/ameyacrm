'use server';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db/prisma';
import { createSession } from '@/lib/auth/session';
import { writeAudit } from '@/lib/audit/log';
import { checkRate, callerIp } from '@/lib/security/rate-limit';
import { completeDeviceApproval } from '@/lib/auth/device';
import { issueMfaTicket } from '@/lib/auth/mfa-ticket';
import { getSecurityPolicy, mustEnroll2FA } from '@/lib/auth/policy';

export type DeviceState = { error?: string };

/** Check the emailed code, and only then create a session. */
export async function verifyDeviceAction(_prev: DeviceState, formData: FormData): Promise<DeviceState> {
  const token = String(formData.get('token') ?? '');
  const code = String(formData.get('code') ?? '').replace(/\D/g, '');
  if (!token) return { error: 'That link is not valid. Please sign in again.' };
  if (code.length !== 6) return { error: 'Enter the six digits from the email.' };

  const rate = await checkRate(`device:${await callerIp()}`, 15, 600);
  if (!rate.allowed) return { error: 'Too many attempts. Please wait ten minutes and sign in again.' };

  const res = await completeDeviceApproval(token, code);
  if (!res.ok) {
    await writeAudit({ action: 'LOGIN_FAILED', summary: `Device code rejected: ${res.error}` }).catch(() => undefined);
    return { error: res.error };
  }

  const user = await prisma.user.findUnique({ where: { id: res.userId } });
  if (!user || user.status !== 'ACTIVE') return { error: 'This account is not active.' };

  /*
   * AMH-056 — approving a device is not the second factor.
   *
   * This minted a full session the moment the six-digit code checked out, with
   * no look at `twoFactorEnabled`. On the password path that was unreachable,
   * because device approval only ever ran for accounts WITHOUT 2FA. The SAML
   * callback ordered it the other way round — device approval first, second
   * factor after — so an SSO user with TOTP enrolled left through this door and
   * never came back to /two-factor.
   *
   * That matters because the code goes to the user's mailbox, and where the
   * identity provider IS the mailbox (Google Workspace, which is what this
   * company runs), whoever compromised the IdP account can read it. The CRM's
   * own TOTP exists precisely to survive that, and this path skipped it.
   *
   * So: hand back to the second factor if there is one. The device is already
   * marked trusted by completeDeviceApproval, so the user is not asked again.
   */
  if (user.twoFactorEnabled && user.twoFactorSecret) {
    await issueMfaTicket(user.id);
    await writeAudit({ actorId: user.id, action: 'LOGIN_FAILED', summary: 'Device approved — second factor still required' });
    redirect('/two-factor');
  }

  await createSession(user.id);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date(), failedLoginCount: 0 } });
  await writeAudit({ actorId: user.id, action: 'LOGIN', summary: 'Signed in after approving a new device' });

  if (user.mustChangePassword) redirect('/settings/security?force=1');
  if (mustEnroll2FA(user, await getSecurityPolicy())) redirect('/settings/security?enroll=1');
  // AMH-068 — a GUEST belongs on the sealed preview, the same as every other
  // sign-in path decides. This one sent them into the workspace shell, which
  // is the one place `getActionContext` then refuses everything they touch.
  if (user.role === 'GUEST') redirect('/demo');
  redirect('/dashboard');
}
