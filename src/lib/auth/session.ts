import 'server-only';
import { cookies, headers } from 'next/headers';
import { addHours } from 'date-fns';
import { prisma } from '@/lib/db/prisma';
import { env } from '@/config/env';
import { randomToken, sha256 } from '@/lib/utils/crypto';
import type { ClientInfo } from '@/types/auth';

import { SESSION_COOKIE, DEVICE_COOKIE } from './constants';
export { SESSION_COOKIE };

function cookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    expires,
  };
}

export async function getClientInfo(): Promise<ClientInfo> {
  const h = await headers();
  const fwd = h.get('x-forwarded-for');
  const ip = fwd ? (fwd.split(',')[0]?.trim() ?? null) : (h.get('x-real-ip') ?? null);
  return { ip, userAgent: h.get('user-agent') };
}

/** Issue a new session: stores only the SHA-256 of the opaque token. */
export async function createSession(userId: string, deviceLabel?: string): Promise<void> {
  const token = randomToken(32);
  const info = await getClientInfo();
  const expiresAt = addHours(new Date(), env.SESSION_TTL_HOURS);

  await prisma.session.create({
    data: {
      userId,
      tokenHash: sha256(token),
      ipAddress: info.ip ?? undefined,
      userAgent: info.userAgent ?? undefined,
      deviceLabel,
      expiresAt,
    },
  });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, cookieOptions(expiresAt));
}

/** Validate cookie → session; enforces absolute + idle expiry. */
export async function readSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: true },
  });
  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;

  // Idle timeout
  const idleMs = env.SESSION_IDLE_TIMEOUT_MINUTES * 60_000;
  if (Date.now() - session.lastActiveAt.getTime() > idleMs) {
    await prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });
    return null;
  }

  // Touch (throttled to once/min to avoid write amplification)
  if (Date.now() - session.lastActiveAt.getTime() > 60_000) {
    await prisma.session.update({ where: { id: session.id }, data: { lastActiveAt: new Date() } });
  }

  return session;
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session
      .updateMany({ where: { tokenHash: sha256(token) }, data: { revokedAt: new Date() } })
      .catch(() => undefined);
  }
  jar.delete(SESSION_COOKIE);
}

export async function markTrustedDevice(userId: string): Promise<void> {
  const jar = await cookies();
  const token = randomToken(24);
  const expires = addHours(new Date(), 24 * 30);
  await prisma.trustedDevice.create({
    data: { userId, deviceHash: sha256(token), expiresAt: expires },
  });
  jar.set(DEVICE_COOKIE, token, cookieOptions(expires));
}

export async function isTrustedDevice(userId: string): Promise<boolean> {
  const jar = await cookies();
  const token = jar.get(DEVICE_COOKIE)?.value;
  if (!token) return false;
  const device = await prisma.trustedDevice.findUnique({ where: { deviceHash: sha256(token) } });
  return !!device && device.userId === userId && device.expiresAt > new Date();
}
