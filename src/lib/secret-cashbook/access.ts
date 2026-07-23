import 'server-only';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { createHash } from 'node:crypto';
import { env } from '@/config/env';
import { prisma } from '@/lib/db/prisma';

/**
 * Gate for the Secret Cash Book.
 *
 * Three layers:
 *  1. Only a nominee (or the Super Admin) may reach it at all.
 *  2. To open it you must enter a one-time code sent to your email + WhatsApp.
 *  3. The unlock lasts a short while, then it re-locks itself.
 *
 * The OTP and the unlock are short-lived signed cookies — no code or secret is
 * ever stored where the browser can read it (all cookies are httpOnly).
 */
const secret = new TextEncoder().encode(env.SESSION_SECRET);
const OTP_COOKIE = 'scb_otp';
const UNLOCK_COOKIE = 'scb_unlock';
const NOMINEE_KEY = 'finance.secret_cashbook_nominees';

const codeHash = (code: string) => createHash('sha256').update(`${code}:${env.SESSION_SECRET}`).digest('hex');

/** The user ids allowed in, besides the Super Admin. */
export async function getNominees(): Promise<string[]> {
  const row = await prisma.setting.findUnique({ where: { key: NOMINEE_KEY } });
  return Array.isArray(row?.value) ? (row!.value as unknown[]).map(String) : [];
}

export async function saveNominees(userIds: string[]): Promise<void> {
  await prisma.setting.upsert({
    where: { key: NOMINEE_KEY },
    create: { key: NOMINEE_KEY, value: userIds },
    update: { value: userIds },
  });
}

export async function canAccess(userId: string, isSuperAdmin: boolean): Promise<boolean> {
  if (isSuperAdmin) return true;
  return (await getNominees()).includes(userId);
}

// ── OTP cookie (holds only a hash of the code) ──────────────────────────────
export async function issueOtp(userId: string, code: string): Promise<void> {
  const token = await new SignJWT({ uid: userId, h: codeHash(code) })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('10m').sign(secret);
  (await cookies()).set(OTP_COOKIE, token, { httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 600 });
}

export async function checkOtp(userId: string, code: string): Promise<boolean> {
  const jar = await cookies();
  const t = jar.get(OTP_COOKIE)?.value;
  if (!t) return false;
  try {
    const { payload } = await jwtVerify(t, secret);
    if (payload.uid !== userId || payload.h !== codeHash(code.trim())) return false;
    jar.delete(OTP_COOKIE); // single use
    return true;
  } catch {
    return false;
  }
}

// ── Unlock ticket ───────────────────────────────────────────────────────────
export async function issueUnlock(userId: string): Promise<void> {
  const token = await new SignJWT({ uid: userId, scope: 'scb' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('15m').sign(secret);
  (await cookies()).set(UNLOCK_COOKIE, token, { httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 900 });
}

export async function isUnlocked(userId: string): Promise<boolean> {
  const t = (await cookies()).get(UNLOCK_COOKIE)?.value;
  if (!t) return false;
  try {
    const { payload } = await jwtVerify(t, secret);
    return payload.uid === userId && payload.scope === 'scb';
  } catch {
    return false;
  }
}

export async function lock(): Promise<void> {
  (await cookies()).delete(UNLOCK_COOKIE);
}
