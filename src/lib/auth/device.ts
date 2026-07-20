import 'server-only';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { addMinutes, addDays } from 'date-fns';
import { prisma } from '@/lib/db/prisma';
import { env } from '@/config/env';
import { sendEmail } from '@/lib/email/email';
import { DEVICE_COOKIE } from './constants';
import { requestCountry, requestCity, countryName } from './geo';

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');
const appUrl = () => env.APP_URL.replace(/\/$/, '');

/** A readable name for a device, from its user-agent. */
export function describeDevice(ua: string | null): string {
  const s = ua ?? '';
  const os = /iPhone/.test(s) ? 'iPhone' : /iPad/.test(s) ? 'iPad' : /Android/.test(s) ? 'Android'
    : /Mac OS X/.test(s) ? 'Mac' : /Windows/.test(s) ? 'Windows' : /Linux/.test(s) ? 'Linux' : 'Unknown device';
  const browser = /Edg\//.test(s) ? 'Edge' : /Chrome\//.test(s) ? 'Chrome' : /Safari\//.test(s) ? 'Safari'
    : /Firefox\//.test(s) ? 'Firefox' : 'browser';
  return `${browser} on ${os}`;
}

/** The device token in the cookie, if this browser has been here before. */
export async function currentDeviceHash(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(DEVICE_COOKIE)?.value;
  return token ? sha256(token) : null;
}

/** Has this exact browser been approved for this person, and not since revoked? */
export async function isKnownDevice(userId: string): Promise<boolean> {
  const hash = await currentDeviceHash();
  if (!hash) return false;
  const d = await prisma.trustedDevice.findUnique({ where: { deviceHash: hash } });
  if (!d || d.userId !== userId || d.revokedAt || d.expiresAt < new Date()) return false;
  await prisma.trustedDevice.update({ where: { id: d.id }, data: { lastSeenAt: new Date() } }).catch(() => undefined);
  return true;
}

/**
 * Start a device approval. Emails a six-digit code to the account holder and
 * returns the token that identifies the challenge.
 *
 * The code is stored only as a hash, compared in constant time, and dies after
 * five attempts — so the challenge cannot be brute-forced even by someone who
 * already has the password.
 */
export async function beginDeviceApproval(user: { id: string; name: string; email: string }): Promise<string> {
  const h = await headers();
  const ua = h.get('user-agent');
  const fwd = h.get('x-forwarded-for');
  const ip = fwd ? fwd.split(',')[0]?.trim() ?? null : null;
  const country = await requestCountry();
  const city = await requestCity();

  // A fresh device token; it only becomes trusted once the code is entered.
  const deviceToken = randomBytes(24).toString('hex');
  const token = randomBytes(24).toString('hex');
  const code = String(Math.floor(100000 + Math.random() * 900000));

  await prisma.deviceApproval.create({
    data: {
      userId: user.id, token, codeHash: sha256(code),
      deviceHash: sha256(deviceToken),
      ipAddress: ip, country, userAgent: ua,
      expiresAt: addMinutes(new Date(), 15),
    },
  });

  const jar = await cookies();
  jar.set(DEVICE_COOKIE, deviceToken, {
    httpOnly: true, secure: true, sameSite: 'lax', path: '/', expires: addDays(new Date(), 30),
  });

  const where = [city, countryName(country)].filter(Boolean).join(', ');
  await sendEmail({
    to: [user.email],
    subject: `Your Ameya Heights CRM code: ${code}`,
    text: [
      `Hello ${user.name},`, '',
      `Somebody is signing in to the Ameya Heights CRM from a device we have not seen before.`,
      '',
      `Your code is: ${code}`,
      '',
      `Device:   ${describeDevice(ua)}`,
      where ? `Location: ${where}` : '',
      ip ? `Address:  ${ip}` : '',
      `Time:     ${new Date().toLocaleString('en-IN')}`,
      '',
      'The code expires in 15 minutes.',
      '',
      'If this was not you, do not share the code. Change your password immediately and tell an administrator — somebody has your password.',
      '',
      '— Ameya Heights CRM',
    ].filter(Boolean).join('\n'),
  });

  return token;
}

export type ApprovalResult =
  | { ok: true; userId: string }
  | { ok: false; error: string; exhausted?: boolean };

/** Check a code the person typed in. */
export async function completeDeviceApproval(token: string, code: string): Promise<ApprovalResult> {
  const rec = await prisma.deviceApproval.findUnique({ where: { token } });
  if (!rec) return { ok: false, error: 'That request is no longer valid. Please sign in again.' };
  if (rec.usedAt) return { ok: false, error: 'That code has already been used. Please sign in again.' };
  if (rec.expiresAt < new Date()) return { ok: false, error: 'That code has expired. Please sign in again.' };
  if (rec.attempts >= 5) return { ok: false, error: 'Too many wrong codes. Please sign in again.', exhausted: true };

  const given = sha256(code.trim());
  const a = Buffer.from(given);
  const b = Buffer.from(rec.codeHash);
  const match = a.length === b.length && timingSafeEqual(a, b);

  if (!match) {
    await prisma.deviceApproval.update({ where: { id: rec.id }, data: { attempts: { increment: 1 } } });
    const left = 4 - rec.attempts;
    return { ok: false, error: left > 0 ? `That code is not right. ${left} attempt${left === 1 ? '' : 's'} left.` : 'Too many wrong codes. Please sign in again.', exhausted: left <= 0 };
  }

  await prisma.deviceApproval.update({ where: { id: rec.id }, data: { usedAt: new Date() } });
  await prisma.trustedDevice.upsert({
    where: { deviceHash: rec.deviceHash },
    update: { revokedAt: null, lastSeenAt: new Date(), expiresAt: addDays(new Date(), 30) },
    create: {
      userId: rec.userId, deviceHash: rec.deviceHash,
      label: describeDevice(rec.userAgent), ipAddress: rec.ipAddress,
      country: rec.country, userAgent: rec.userAgent,
      expiresAt: addDays(new Date(), 30),
    },
  });

  return { ok: true, userId: rec.userId };
}

/** Tell someone their account was used from somewhere new. Detection, not blocking. */
export async function alertNewSignIn(user: { name: string; email: string }, opts: { country: string | null; city: string | null; ip: string | null; ua: string | null }): Promise<void> {
  const where = [opts.city, countryName(opts.country)].filter(Boolean).join(', ');
  await sendEmail({
    to: [user.email],
    subject: 'New sign-in to your Ameya Heights CRM account',
    text: [
      `Hello ${user.name},`, '',
      'Your account was just used to sign in.', '',
      `Device:   ${describeDevice(opts.ua)}`,
      where ? `Location: ${where}` : '',
      opts.ip ? `Address:  ${opts.ip}` : '',
      `Time:     ${new Date().toLocaleString('en-IN')}`,
      '',
      'If that was you, nothing to do.',
      '',
      `If it was not, change your password now at ${appUrl()}/settings/security and tell an administrator.`,
      '',
      '— Ameya Heights CRM',
    ].filter(Boolean).join('\n'),
  }).catch(() => undefined);
}
