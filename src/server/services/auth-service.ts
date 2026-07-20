import 'server-only';
import { addMinutes, differenceInDays } from 'date-fns';
import type { User } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { env } from '@/config/env';
import { verifyPassword } from '@/lib/auth/password';
import { getClientInfo } from '@/lib/auth/session';

export type AuthResult =
  | { status: 'ok'; user: User; mustChangePassword: boolean }
  | { status: 'needs_2fa'; user: User }
  | { status: 'locked'; retryAt: Date }
  | { status: 'disabled' }
  | { status: 'pending' }
  | { status: 'invalid' };

async function recordLogin(userId: string | null, username: string, success: boolean, reason?: string) {
  const info = await getClientInfo();
  await prisma.loginHistory.create({
    data: {
      userId: userId ?? undefined,
      username,
      success,
      reason,
      ipAddress: info.ip ?? undefined,
      userAgent: info.userAgent ?? undefined,
    },
  });
}

/**
 * Verify credentials with account-lockout and login-history side effects.
 * Uses a generic 'invalid' result for unknown user AND wrong password to avoid
 * username enumeration.
 */
export async function authenticate(identifier: string, password: string): Promise<AuthResult> {
  const id = identifier.trim();
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ username: id }, { email: id.toLowerCase() }],
      deletedAt: null,
    },
  });

  if (!user) {
    await recordLogin(null, id, false, 'user_not_found');
    return { status: 'invalid' };
  }

  if (user.status === 'PENDING' || user.status === 'INVITED') {
    await recordLogin(user.id, id, false, 'account_pending');
    return { status: 'pending' };
  }

  if (user.status === 'DISABLED' || user.status === 'SUSPENDED') {
    await recordLogin(user.id, id, false, 'account_' + user.status.toLowerCase());
    return { status: 'disabled' };
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await recordLogin(user.id, id, false, 'locked');
    return { status: 'locked', retryAt: user.lockedUntil };
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    const failed = user.failedLoginCount + 1;
    const shouldLock = failed >= env.MAX_FAILED_LOGINS;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: shouldLock ? 0 : failed,
        lockedUntil: shouldLock ? addMinutes(new Date(), env.LOCKOUT_MINUTES) : user.lockedUntil,
      },
    });
    await recordLogin(user.id, id, false, shouldLock ? 'locked_now' : 'bad_password');
    if (shouldLock) return { status: 'locked', retryAt: addMinutes(new Date(), env.LOCKOUT_MINUTES) };
    return { status: 'invalid' };
  }

  // Success — reset counters.
  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
  });

  const expired =
    env.PASSWORD_EXPIRY_DAYS > 0 &&
    differenceInDays(new Date(), user.passwordChangedAt) >= env.PASSWORD_EXPIRY_DAYS;
  const mustChange = user.mustChangePassword || expired;

  if (user.twoFactorEnabled) {
    // History for the 2FA-pending stage is written after the second factor.
    return { status: 'needs_2fa', user };
  }

  await recordLogin(user.id, id, true, 'password');
  return { status: 'ok', user, mustChangePassword: mustChange };
}

export async function markLoginSuccess(userId: string, username: string, reason: string) {
  await recordLogin(userId, username, true, reason);
}
