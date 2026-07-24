import { describe, it, expect } from 'vitest';
import { validatePasswordStrength, passwordPolicy } from '@/lib/auth/password';

/**
 * The policy is deliberately length-only: at least eight characters, no
 * required symbols or capitals. Length beats complexity, and complexity rules
 * push people towards Passw0rd! and a sticky note.
 */
describe('password policy', () => {
  it('rejects anything under the minimum length', () => {
    expect(validatePasswordStrength('short')).not.toHaveLength(0);
    expect(validatePasswordStrength('a'.repeat(passwordPolicy.minLength - 1))).not.toHaveLength(0);
  });

  it('accepts a long passphrase with no symbols or capitals', () => {
    expect(validatePasswordStrength('alllowercase123')).toHaveLength(0);
    expect(validatePasswordStrength('correct horse battery')).toHaveLength(0);
  });

  it('still accepts a complex password', () => {
    expect(validatePasswordStrength('Ameya@Heights2026')).toHaveLength(0);
  });

  it('accepts exactly the minimum length', () => {
    expect(validatePasswordStrength('a'.repeat(passwordPolicy.minLength))).toHaveLength(0);
  });
});
