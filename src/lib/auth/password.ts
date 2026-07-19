import 'server-only';
import bcrypt from 'bcryptjs';

/**
 * Password hashing (bcrypt, cost 12). For a hardware-accelerated deployment,
 * swap to Argon2id via @node-rs/argon2 — the interface here is intentionally
 * minimal so the algorithm is a one-file change.
 */
const COST = 12;

export const passwordPolicy = {
  minLength: 8,
  requireUpper: false,
  requireLower: false,
  requireNumber: false,
  requireSymbol: false,
};

export function validatePasswordStrength(pw: string): string[] {
  const errors: string[] = [];
  if (pw.length < passwordPolicy.minLength)
    errors.push(`At least ${passwordPolicy.minLength} characters`);
  if (passwordPolicy.requireUpper && !/[A-Z]/.test(pw)) errors.push('One uppercase letter');
  if (passwordPolicy.requireLower && !/[a-z]/.test(pw)) errors.push('One lowercase letter');
  if (passwordPolicy.requireNumber && !/[0-9]/.test(pw)) errors.push('One number');
  if (passwordPolicy.requireSymbol && !/[^A-Za-z0-9]/.test(pw)) errors.push('One symbol');
  return errors;
}

export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, COST);
}

export async function verifyPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash);
}
