'use server';

import { redirect } from 'next/navigation';
import type { RegistrationResponseJSON, AuthenticationResponseJSON } from '@simplewebauthn/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/current-user';
import { createSession } from '@/lib/auth/session';
import { markLoginSuccess } from '@/server/services/auth-service';
import { getSecurityPolicy, countryAllowed } from '@/lib/auth/policy';
import { requestCountry, countryName } from '@/lib/auth/geo';
import { writeAudit } from '@/lib/audit/log';
import { checkRate, callerIp } from '@/lib/security/rate-limit';
import {
  passkeyRegistrationOptions, verifyPasskeyRegistration,
  passkeyLoginOptions, verifyPasskeyLogin, listPasskeys, removePasskey,
} from '@/server/services/passkey-service';
import { toActionError } from '@/server/actions/_helpers';

export async function startPasskeyEnrollment() {
  const { user } = await requireAuth();
  return passkeyRegistrationOptions(user.id);
}

export async function finishPasskeyEnrollment(response: RegistrationResponseJSON, label: string) {
  try {
    const { user } = await requireAuth();
    const r = await verifyPasskeyRegistration(user.id, response, label);
    if ('error' in r) return r;
    await writeAudit({ actorId: user.id, action: 'UPDATE', entityType: 'User', entityId: user.id, summary: `Added a passkey (${label})` });
    return { ok: true as const };
  } catch (e) {
    return toActionError(e);
  }
}

export async function myPasskeys() {
  const { user } = await requireAuth();
  return listPasskeys(user.id);
}

export async function deletePasskey(id: string) {
  try {
    const { user } = await requireAuth();
    const gone = await removePasskey(user.id, id);
    if (!gone) return { error: 'That passkey was not found.' };
    await writeAudit({ actorId: user.id, action: 'DELETE', entityType: 'User', entityId: user.id, summary: 'Removed a passkey' });
    return { ok: true as const };
  } catch (e) {
    return toActionError(e);
  }
}

export async function startPasskeyLogin() {
  return passkeyLoginOptions();
}

/**
 * Sign in with a passkey.
 *
 * No second factor is asked for afterwards. A passkey already proves both the
 * device and the person (fingerprint, face or device PIN), and it cannot be
 * handed to a fake site the way a typed code can — so demanding a code on top
 * would add friction without adding safety.
 */
export async function finishPasskeyLogin(response: AuthenticationResponseJSON) {
  const ip = await callerIp();
  const gate = await checkRate(`passkey:ip:${ip}`, 20, 300);
  if (!gate.allowed) return { error: 'Too many attempts. Please wait a few minutes.' };

  const r = await verifyPasskeyLogin(response);
  if ('error' in r) {
    await prisma.loginHistory.create({
      data: { success: false, reason: 'passkey_failed', ipAddress: ip },
    }).catch(() => undefined);
    return r;
  }

  const user = await prisma.user.findUnique({ where: { id: r.userId } });
  if (!user) return { error: 'That account no longer exists.' };
  if (user.status !== 'ACTIVE') return { error: 'This account is not active. Contact your administrator.' };

  const policy = await getSecurityPolicy();
  const country = await requestCountry();
  if (!countryAllowed(country, user, policy)) {
    await writeAudit({ actorId: user.id, action: 'LOGIN_FAILED', summary: `Refused passkey sign-in from ${countryName(country)}` });
    return { error: `Sign-in from ${countryName(country)} is not permitted.` };
  }

  await createSession(user.id);
  await markLoginSuccess(user.id, user.username, 'passkey');
  await writeAudit({ actorId: user.id, action: 'LOGIN', summary: `Passkey sign-in from ${countryName(country)}` });
  redirect(user.mustChangePassword ? '/settings/security?force=1' : '/dashboard');
}
