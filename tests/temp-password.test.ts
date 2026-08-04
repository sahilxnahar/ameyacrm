import { describe, it, expect } from 'vitest';
import { generateTempPassword } from '@/lib/auth/temp-password';

describe('generateTempPassword', () => {
  it('meets the minimum length policy (>= 8) by default', () => {
    expect(generateTempPassword().length).toBe(14);
    expect(generateTempPassword(6).length).toBe(12); // clamped up to the policy minimum
  });

  it('avoids visually ambiguous characters (0 O 1 l I)', () => {
    // Deterministic pick returning 0 keeps output within the known alphabets.
    const pw = generateTempPassword(12, () => 0);
    expect(pw).not.toMatch(/[0O1lI]/);
    expect(pw.length).toBe(12);
  });

  it('always contains at least two digits', () => {
    // With a fixed RNG the composition is still 2 digits + letters.
    const pw = generateTempPassword(10, (max) => max - 1);
    const digits = pw.replace(/[^23456789]/g, '');
    expect(digits.length).toBeGreaterThanOrEqual(2);
  });

  it('is deterministic given a deterministic picker', () => {
    const a = generateTempPassword(10, (max) => max - 1);
    const b = generateTempPassword(10, (max) => max - 1);
    expect(a).toBe(b);
  });
});

/**
 * AMH-057 — the password the SYSTEM issues must not be weaker than the weakest
 * one a person is allowed to choose. temp-password.ts is client-safe and cannot
 * import the server-only policy, so the number is duplicated there; this is
 * what stops the copies drifting apart.
 */
describe('the generated password satisfies the real policy', () => {
  it('is never shorter than passwordPolicy.minLength', async () => {
    const { passwordPolicy } = await import('@/lib/auth/password');
    expect(generateTempPassword().length).toBeGreaterThanOrEqual(passwordPolicy.minLength);
    expect(generateTempPassword(1).length).toBeGreaterThanOrEqual(passwordPolicy.minLength);
    expect(generateTempPassword(4).length).toBeGreaterThanOrEqual(passwordPolicy.minLength);
  });
});
