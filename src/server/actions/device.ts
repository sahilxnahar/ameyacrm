'use server';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db/prisma';
import { createSession } from '@/lib/auth/session';
import { writeAudit } from '@/lib/audit/log';
import { checkRate, callerIp } from '@/lib/security/rate-limit';
import { completeDeviceApproval } from '@/lib/auth/device';
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

  await createSession(user.id);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date(), failedLoginCount: 0 } });
  await writeAudit({ actorId: user.id, action: 'LOGIN', summary: 'Signed in after approving a new device' });

  if (user.mustChangePassword) redirect('/settings/security?force=1');
  if (mustEnroll2FA(user, await getSecurityPolicy())) redirect('/settings/security?enroll=1');
  redirect('/dashboard');
}
