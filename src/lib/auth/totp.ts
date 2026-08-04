import 'server-only';
import { authenticator } from 'otplib';
import bcrypt from 'bcryptjs';
import QRCode from 'qrcode';
import { randomBytes } from 'node:crypto';
import { encrypt, decrypt } from '@/lib/utils/crypto';

authenticator.options = { window: 1, step: 30 };

export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

/** AES-encrypt the TOTP secret before it ever touches the database. */
export function sealSecret(secret: string): string {
  return encrypt(secret);
}
export function openSecret(sealed: string): string {
  return decrypt(sealed);
}

export function totpUri(secret: string, account: string, issuer = 'Ameya Heights CRM'): string {
  return authenticator.keyuri(account, issuer, secret);
}

export async function totpQrDataUrl(uri: string): Promise<string> {
  return QRCode.toDataURL(uri, { margin: 1, width: 220 });
}

export function verifyTotp(token: string, secret: string): boolean {
  try {
    return authenticator.verify({ token: token.replace(/\s/g, ''), secret });
  } catch {
    return false;
  }
}

const STEP_SECONDS = 30;

/**
 * Which 30-second step a token belongs to, or null if it is not a valid code
 * for this secret. `window: 1` means a code is accepted for its own step plus
 * one either side, so the answer is the CURRENT step shifted by that delta —
 * not simply "now".
 */
export function totpStepFor(token: string, secret: string): number | null {
  try {
    const delta = authenticator.checkDelta(token.replace(/\s/g, ''), secret);
    if (delta === null || delta === undefined) return null;
    return Math.floor(Date.now() / 1000 / STEP_SECONDS) + delta;
  } catch {
    return null;
  }
}

/**
 * AMH-053 — verify a TOTP code and burn it.
 *
 * `verifyTotp` alone accepts a code for the whole ~90-second window, and
 * accepts it as many times as it is presented. So a code seen once — over a
 * shoulder, in a screen share, in a phishing proxy that relays it — stays
 * usable by anyone who also has the password, for the rest of that window.
 *
 * Recording the step that was consumed closes that: a code is good once, and
 * every code from that step or earlier is refused afterwards. The comparison
 * is `<=`, not `!==`, so replaying the PREVIOUS step's still-in-window code
 * after the current one has been used is refused too.
 *
 * The update is conditional on the step we read, so two requests racing with
 * the same code cannot both win: the loser's `updateMany` matches no row.
 */
export async function verifyTotpOnce(userId: string, token: string, secret: string): Promise<boolean> {
  const step = totpStepFor(token, secret);
  if (step === null) return false;

  const { prisma } = await import('@/lib/db/prisma');
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { twoFactorLastStep: true } });
  const last = user?.twoFactorLastStep ?? null;
  if (last !== null && step <= Number(last)) return false;

  const claimed = await prisma.user.updateMany({
    where: last === null
      ? { id: userId, twoFactorLastStep: null }
      : { id: userId, twoFactorLastStep: last },
    data: { twoFactorLastStep: BigInt(step) },
  });
  return claimed.count === 1;
}

/** Generate N single-use backup codes; return plaintext (show once) + hashes. */
export async function generateBackupCodes(count = 10): Promise<{ codes: string[]; hashes: string[] }> {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const raw = randomBytes(5).toString('hex'); // 10 hex chars
    codes.push(`${raw.slice(0, 5)}-${raw.slice(5)}`);
  }
  const hashes = await Promise.all(codes.map((c) => bcrypt.hash(c.replace('-', ''), 10)));
  return { codes, hashes };
}

export async function verifyBackupCode(input: string, hash: string): Promise<boolean> {
  return bcrypt.compare(input.replace(/[\s-]/g, ''), hash);
}
