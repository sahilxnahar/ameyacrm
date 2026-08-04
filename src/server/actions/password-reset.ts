'use server';
import { createHash, randomBytes } from 'node:crypto';
import { escapeHtml } from '@/lib/email/escape';
import { prisma } from '@/lib/db/prisma';
import { env } from '@/config/env';
import { sendEmail } from '@/lib/email/email';
import { hashPassword, validatePasswordStrength } from '@/lib/auth/password';
import { checkRate, callerIp } from '@/lib/security/rate-limit';
import { writeAudit } from '@/lib/audit/log';

const DEVICE_HASH = 'password-reset'; // reuses the DeviceApproval table — no new model
const TTL_MIN = 30;

export type ResetRequestState = { ok?: boolean; message?: string; error?: string };
export type ResetCompleteState = { ok?: boolean; error?: string };

/**
 * Step 1 — someone forgot their password. We email a one-time reset link.
 *
 * The reply is always the same whether or not the account exists, so this can
 * never be used to discover who has an account. Reuses the DeviceApproval token
 * table (same pattern as the emailed sign-in code), so there is no new table
 * and no migration.
 */
export async function requestPasswordReset(identifier: string): Promise<ResetRequestState> {
  const id = (identifier ?? '').trim();
  if (!id) return { error: 'Enter your username or email.' };

  const ip = await callerIp();
  const byIp = await checkRate(`pwreset:ip:${ip}`, 10, 900);
  const byId = await checkRate(`pwreset:id:${id.toLowerCase()}`, 5, 900);
  const generic = { ok: true, message: 'If that account exists, a reset link is on its way. Check your email (and spam).' };
  if (!byIp.allowed || !byId.allowed) return generic;

  try {
    const user = await prisma.user.findFirst({
      where: {
        status: 'ACTIVE',
        OR: [{ email: { equals: id, mode: 'insensitive' } }, { username: { equals: id, mode: 'insensitive' } }],
      },
      select: { id: true, name: true, email: true },
    });
    if (!user) return generic;

    const token = `pwr_${randomBytes(24).toString('hex')}`;
    const tokenHash = createHash('sha256').update(token).digest('hex');
    await prisma.deviceApproval.create({
      data: {
        userId: user.id,
        // F-29: never persist the raw token. The emailed link carries the raw
        // token; the DB stores only its SHA-256 so a DB/backup/log leak cannot be
        // replayed to seize the reset.
        token: tokenHash,
        codeHash: tokenHash,
        deviceHash: DEVICE_HASH,
        expiresAt: new Date(Date.now() + TTL_MIN * 60 * 1000),
      },
    });

    const link = `${env.APP_URL.replace(/\/$/, '')}/reset-password?t=${token}`;
    await sendEmail({
      to: [user.email],
      subject: 'Reset your Ameya Heights CRM password',
      text: `Hello ${escapeHtml(user.name)},\n\nReset your password using this link (valid for ${TTL_MIN} minutes, one use):\n${link}\n\nIf you did not request this, you can ignore this email — your password stays the same.\n\n— Ameya Heights CRM`,
      html:
        `<p>Hello ${escapeHtml(user.name)},</p>` +
        `<p>Reset your password with the button below. The link is valid for ${TTL_MIN} minutes and can be used once.</p>` +
        `<p><a href="${link}" style="display:inline-block;padding:10px 18px;background:#A07D34;color:#fff;border-radius:6px;text-decoration:none">Reset my password</a></p>` +
        `<p>Or paste this into your browser:<br><span style="word-break:break-all">${link}</span></p>` +
        `<p>If you did not request this, ignore this email — your password stays the same.</p>` +
        `<p>— Ameya Heights CRM</p>`,
    });
    await writeAudit({ actorId: user.id, action: 'PASSWORD_CHANGE', entityType: 'User', entityId: user.id, summary: 'Password reset link requested' });
    return generic;
  } catch {
    // Never reveal an internal failure here — keep the generic reply.
    return generic;
  }
}

/**
 * Step 2 — the link is opened and a new password is chosen.
 *
 * Validates the token (single-use, unexpired), sets the new password, revokes
 * every existing session, and marks the token used.
 */
export async function completePasswordReset(token: string, password: string): Promise<ResetCompleteState> {
  const t = (token ?? '').trim();
  const pw = password ?? '';
  if (!t) return { error: 'This reset link is invalid. Request a new one.' };

  const pwErrors = validatePasswordStrength(pw);
  if (pwErrors.length) return { error: `Password needs: ${pwErrors.join(', ')}.` };

  try {
    // F-29: look the token up by its hash, not the raw value.
    const tHash = createHash('sha256').update(t).digest('hex');
    const row = await prisma.deviceApproval.findFirst({
      where: { codeHash: tHash, deviceHash: DEVICE_HASH, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!row) return { error: 'This reset link is invalid or has expired. Request a new one.' };

    await prisma.$transaction([
      prisma.user.update({
        where: { id: row.userId },
        data: { passwordHash: await hashPassword(pw), passwordChangedAt: new Date(), mustChangePassword: false },
      }),
      prisma.deviceApproval.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
      prisma.session.updateMany({ where: { userId: row.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    await writeAudit({ actorId: row.userId, action: 'PASSWORD_CHANGE', entityType: 'User', entityId: row.userId, summary: 'Password reset completed' });
    return { ok: true };
  } catch {
    return { error: 'Something went wrong resetting the password. Please request a new link.' };
  }
}
