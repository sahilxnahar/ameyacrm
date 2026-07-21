import 'server-only';
import { SignJWT, jwtVerify } from 'jose';
import { cookies, headers } from 'next/headers';
import { env } from '@/config/env';

const secret = new TextEncoder().encode(env.SESSION_SECRET);
const CHALLENGE_COOKIE = 'ah_wa_ch';

/**
 * The site the passkey is bound to.
 *
 * A passkey is locked to one domain by design — that is what makes it
 * unphishable — so this must be the bare host, with no scheme and no port.
 * Derived from the live request rather than configuration so that localhost,
 * preview builds and crm.ameyaheights.com each work without anyone editing an
 * environment variable.
 */
export async function relyingParty(): Promise<{ rpID: string; origin: string }> {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return { rpID: host.split(':')[0] ?? host, origin: `${proto}://${host}` };
}

/** Challenges live in a signed, 5-minute cookie — no table, nothing to clean up. */
export async function stashChallenge(challenge: string, purpose: 'register' | 'login'): Promise<void> {
  const token = await new SignJWT({ c: challenge, p: purpose })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(secret);
  const jar = await cookies();
  jar.set(CHALLENGE_COOKIE, token, {
    httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 300,
  });
}

export async function takeChallenge(purpose: 'register' | 'login'): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(CHALLENGE_COOKIE)?.value;
  if (!token) return null;
  jar.delete(CHALLENGE_COOKIE); // single use, whatever happens next
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload.p === purpose && typeof payload.c === 'string' ? payload.c : null;
  } catch {
    return null;
  }
}
