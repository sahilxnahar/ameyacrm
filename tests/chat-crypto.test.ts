import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, looksEncrypted, decryptSafe, sha256, safeEqual } from '@/lib/utils/crypto';

describe('at-rest crypto (v15.16 chat encryption)', () => {
  it('round-trips a message', () => {
    const plain = 'Meet at site at 4pm — bring the drawings 🏗️';
    const enc = encrypt(plain);
    expect(enc).not.toBe(plain);
    expect(decrypt(enc)).toBe(plain);
  });

  it('produces a different ciphertext each time (random IV)', () => {
    expect(encrypt('same')).not.toBe(encrypt('same'));
  });

  it('recognises its own ciphertext format', () => {
    expect(looksEncrypted(encrypt('x'))).toBe(true);
    expect(looksEncrypted('just plain text')).toBe(false);
    expect(looksEncrypted('a.b')).toBe(false); // only two parts
  });

  it('decryptSafe is backward compatible with pre-encryption plain text', () => {
    expect(decryptSafe('legacy plain message')).toBe('legacy plain message');
    expect(decryptSafe(encrypt('secret'))).toBe('secret');
    expect(decryptSafe(null)).toBe('');
  });

  it('sha256 is stable and hex', () => {
    expect(sha256('abc')).toBe(sha256('abc'));
    expect(sha256('abc')).toMatch(/^[a-f0-9]{64}$/);
  });

  it('safeEqual compares in constant length-aware fashion', () => {
    expect(safeEqual('token', 'token')).toBe(true);
    expect(safeEqual('token', 'other')).toBe(false);
    expect(safeEqual('token', 'tok')).toBe(false);
  });
});
