import { describe, it, expect } from 'vitest';
import { validatePasswordStrength } from '@/lib/auth/password';

describe('password policy', () => {
  it('rejects weak passwords', () => {
    expect(validatePasswordStrength('short').length).toBeGreaterThan(0);
    expect(validatePasswordStrength('alllowercase123').length).toBeGreaterThan(0);
  });
  it('accepts a strong password', () => {
    expect(validatePasswordStrength('Ameya@Heights2026')).toHaveLength(0);
  });
});
