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
