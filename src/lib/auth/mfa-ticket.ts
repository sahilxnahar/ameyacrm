import 'server-only';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { env } from '@/config/env';
import { MFA_TICKET_COOKIE as TICKET_COOKIE } from './constants';

/**
 * Short-lived "half-authenticated" ticket issued after a correct password when
 * 2FA is required. It authorizes ONLY the /two-factor step and expires in 5 min.
 */
const secret = new TextEncoder().encode(env.SESSION_SECRET);

export async function issueMfaTicket(userId: string): Promise<void> {
  const token = await new SignJWT({ uid: userId, stage: '2fa' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(secret);
  const jar = await cookies();
  jar.set(TICKET_COOKIE, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 300,
  });
}

export async function readMfaTicket(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(TICKET_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload.stage === '2fa' && typeof payload.uid === 'string' ? payload.uid : null;
  } catch {
    return null;
  }
}

export async function clearMfaTicket(): Promise<void> {
  const jar = await cookies();
  jar.delete(TICKET_COOKIE);
}
