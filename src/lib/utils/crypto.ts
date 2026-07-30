import 'server-only';
import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from '@/config/env';

// F-35: surface a weak ENCRYPTION_KEY once at startup. We deliberately do NOT
// change the derivation here (that would make all existing ciphertext — 2FA
// secrets, mailbox passwords — unreadable; rotating the key requires a dedicated
// re-encryption migration). This is an early-warning only.
let keyWarned = false;
function assertKeyStrength(): void {
  if (keyWarned) return;
  keyWarned = true;
  const k = env.ENCRYPTION_KEY ?? '';
  if (k.length < 32 || /^(build-time-placeholder|please-change|changeme|secret)/i.test(k)) {
    console.warn('[crypto] ENCRYPTION_KEY looks weak or placeholder — use a 32-byte random value in production.');
  }
}

/** 32-byte key derived deterministically from ENCRYPTION_KEY. */
function key(): Buffer {
  assertKeyStrength();
  return createHash('sha256').update(env.ENCRYPTION_KEY).digest();
}

/** AES-256-GCM encrypt → `iv.tag.ciphertext` (all base64url). */
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, enc].map((b) => b.toString('base64url')).join('.');
}

export function decrypt(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split('.');
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('Malformed ciphertext');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(ivB64, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

/** Does this string look like our `iv.tag.ciphertext` format (3 base64url parts)? */
export function looksEncrypted(value: string): boolean {
  const parts = value.split('.');
  return parts.length === 3 && parts.every((p) => p.length > 0 && /^[A-Za-z0-9_-]+$/.test(p));
}

/**
 * Decrypt if the value is our ciphertext; otherwise return it unchanged.
 *
 * This lets a field be encrypted going forward without a risky bulk migration:
 * rows written before encryption was switched on are still plain text and are
 * returned as-is, while new rows decrypt normally. Any decryption error also
 * falls back to the raw value rather than throwing — a stored message must never
 * become unreadable because of a key mishap.
 */
export function decryptSafe(value: string | null | undefined): string {
  if (!value) return '';
  if (!looksEncrypted(value)) return value;
  // F-36: a value that LOOKS encrypted but fails to decrypt indicates tampering
  // or a key mismatch — log it (observability) before the back-compat fallback.
  try { return decrypt(value); } catch { console.warn('[crypto] decryptSafe: ciphertext failed to decrypt (tamper or key mismatch)'); return value; }
}

/** SHA-256 hex — used for opaque session/device tokens (not passwords). */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
