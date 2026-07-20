'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { breachVerdict } from '@/lib/auth/breach';
import { getSecurityPolicy } from '@/lib/auth/policy';
import { hashPassword, verifyPassword, validatePasswordStrength } from '@/lib/auth/password';
import {
  generateTotpSecret, sealSecret, openSecret, totpUri, totpQrDataUrl, verifyTotp, generateBackupCodes,
} from '@/lib/auth/totp';
import { writeAudit } from '@/lib/audit/log';
import { getActionContext, toActionError } from './_helpers';

export type SecurityResult = { ok: true } | { error: string };

/** Step 1 — generate a secret + QR. Secret is sealed and stored, 2FA stays OFF until confirmed. */
export async function startTwoFactorSetup(): Promise<{ qr: string; secret: string } | { error: string }> {
  try {
    const ctx = await getActionContext();
    const secret = generateTotpSecret();
    await prisma.user.update({ where: { id: ctx.user.id }, data: { twoFactorSecret: sealSecret(secret) } });
    const uri = totpUri(secret, ctx.user.email);
    return { qr: await totpQrDataUrl(uri), secret };
  } catch (err) {
    return toActionError(err);
  }
}

/** Step 2 — confirm a TOTP code, enable 2FA, and issue one-time backup codes. */
export async function confirmTwoFactor(code: string): Promise<{ ok: true; backupCodes: string[] } | { error: string }> {
  try {
    const ctx = await getActionContext();
    const user = await prisma.user.findUnique({ where: { id: ctx.user.id } });
    if (!user?.twoFactorSecret) return { error: 'Start setup first.' };
    if (!verifyTotp(code, openSecret(user.twoFactorSecret))) return { error: 'Incorrect code. Try again.' };

    const { codes, hashes } = await generateBackupCodes(10);
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: true } }),
      prisma.backupCode.deleteMany({ where: { userId: user.id } }),
      prisma.backupCode.createMany({ data: hashes.map((codeHash) => ({ userId: user.id, codeHash })) }),
    ]);
    await writeAudit({ actorId: user.id, action: 'TWO_FACTOR_ENABLED', entityType: 'User', entityId: user.id });
    revalidatePath('/settings/security');
    return { ok: true, backupCodes: codes };
  } catch (err) {
    return toActionError(err);
  }
}

export async function disableTwoFactor(password: string): Promise<SecurityResult> {
  try {
    const ctx = await getActionContext();
    const user = await prisma.user.findUnique({ where: { id: ctx.user.id } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) return { error: 'Incorrect password.' };
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: false, twoFactorSecret: null } }),
      prisma.backupCode.deleteMany({ where: { userId: user.id } }),
    ]);
    await writeAudit({ actorId: user.id, action: 'TWO_FACTOR_DISABLED', entityType: 'User', entityId: user.id });
    revalidatePath('/settings/security');
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}

const pwSchema = z.object({ current: z.string().min(1), next: z.string().min(8) });
export async function changePassword(input: unknown): Promise<SecurityResult> {
  try {
    const ctx = await getActionContext();
    const d = pwSchema.parse(input);
    const errs = validatePasswordStrength(d.next);
    const policy = await getSecurityPolicy();
    if (policy.breachCheck) {
      const breach = await breachVerdict(d.next);
      if (!breach.ok) return { error: breach.message ?? 'Please choose a different password.' };
    }
    if (errs.length) return { error: `Weak password: ${errs.join(', ')}` };

    const user = await prisma.user.findUnique({ where: { id: ctx.user.id } });
    if (!user || !(await verifyPassword(d.current, user.passwordHash))) return { error: 'Current password is incorrect.' };

    // Prevent reuse of the last 5 passwords.
    const history = await prisma.passwordHistory.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 5 });
    for (const h of history) if (await verifyPassword(d.next, h.passwordHash)) return { error: 'You cannot reuse a recent password.' };

    const newHash = await hashPassword(d.next);
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { passwordHash: newHash, passwordChangedAt: new Date(), mustChangePassword: false } }),
      prisma.passwordHistory.create({ data: { userId: user.id, passwordHash: user.passwordHash } }),
    ]);
    await writeAudit({ actorId: user.id, action: 'PASSWORD_CHANGE', entityType: 'User', entityId: user.id, summary: 'User changed password' });
    revalidatePath('/settings/security');
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}
