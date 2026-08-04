import 'server-only';
import { cookies, headers } from 'next/headers';
import { addHours } from 'date-fns';
import { prisma } from '@/lib/db/prisma';
import { getSecurityPolicy } from '@/lib/auth/policy';
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

  /*
   * ── AMH-004 ────────────────────────────────────────────────────────────────
   *
   * Admin → Security policy has a "sessions last N hours" setting. It had ZERO
   * consumers: every session was cut to `env.SESSION_TTL_HOURS` regardless, so
   * an administrator could set eight hours, see it saved, and get twelve.
   *
   * A security control that reports a value it does not apply is worse than an
   * absent one, because it ends the conversation — nobody checks a setting they
   * have already configured.
   *
   * The env value is now the CEILING rather than the answer: the policy may
   * shorten a session but never lengthen it past what the deployment allows.
   * `getSecurityPolicy` never throws, so a settings failure cannot stop sign-in.
   */
  const policy = await getSecurityPolicy().catch(() => null);
  const hours = Math.min(
    policy?.sessionHours && policy.sessionHours > 0 ? policy.sessionHours : env.SESSION_TTL_HOURS,
    env.SESSION_TTL_HOURS,
  );
  const expiresAt = addHours(new Date(), hours);

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

/**
 * Raised when the session cannot be CHECKED — as opposed to being absent.
 *
 * The distinction matters more than it looks. Swallowing a database error and
 * returning null means "not signed in", and the caller then redirects to the
 * login page. So a momentary blip — a sleeping Neon instance waking up, a
 * connection pool briefly exhausted — silently signed everybody out mid-task.
 * From the user's side it is indistinguishable from being logged out at random
 * on almost every page load, which is precisely the reported symptom.
 */
export class SessionUnavailableError extends Error {
  constructor() {
    super('Could not verify your session because the database did not respond.');
    this.name = 'SessionUnavailableError';
  }
}

/** Validate cookie → session; enforces absolute + idle expiry. */
export async function readSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  let session;
  try {
    session = await prisma.session.findUnique({
      where: { tokenHash: sha256(token) },
      include: { user: true },
    });
  } catch {
    // One retry, after a short pause. The overwhelmingly common cause is a
    // serverless database that was asleep and needs a moment; the second
    // attempt almost always succeeds.
    await new Promise((r) => setTimeout(r, 250));
    try {
      session = await prisma.session.findUnique({
        where: { tokenHash: sha256(token) },
        include: { user: true },
      });
    } catch {
      // Still unreachable. Say so — never quietly sign the person out over an
      // infrastructure hiccup, because that destroys unsaved work and looks
      // like a security event.
      throw new SessionUnavailableError();
    }
  }
  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;

  // Idle timeout. `lastActiveAt` is refreshed at most once a minute while the
  // person is using the app, so this only bites genuine inactivity.
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
