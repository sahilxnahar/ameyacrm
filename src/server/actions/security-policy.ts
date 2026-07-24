'use server';
import { addDays } from 'date-fns';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from '@/server/actions/_helpers';
import { DEFAULT_POLICY, type SecurityPolicy } from '@/lib/auth/policy';

export type PolResult = { ok: true; message?: string } | { error: string };

/**
 * Save the security policy.
 *
 * Turning on mandatory 2FA gives everyone who has not enrolled a fresh grace
 * window, so switching it on never locks the company out on a Monday morning.
 */
export async function saveSecurityPolicy(input: Partial<SecurityPolicy>): Promise<PolResult> {
  try {
    const ctx = await ensure('admin.setting.manage');
    const cfg: SecurityPolicy = {
      ...DEFAULT_POLICY,
      ...input,
      graceDays: Math.min(30, Math.max(0, Number(input.graceDays ?? DEFAULT_POLICY.graceDays))),
      allowedCountries: (input.allowedCountries ?? DEFAULT_POLICY.allowedCountries)
        .map((c) => String(c).trim().toUpperCase()).filter((c) => c.length === 2),
    };
    if (cfg.geoRestrict && cfg.allowedCountries.length === 0) {
      return { error: 'Add at least one country before restricting by location, or nobody can sign in.' };
    }

    await prisma.setting.upsert({
      where: { key: 'security.policy' },
      update: { value: cfg as unknown as object },
      create: { key: 'security.policy', value: cfg as unknown as object },
    });

    let granted = 0;
    if (cfg.require2FA || cfg.require2FAForAdmins) {
      const roles = cfg.require2FA ? undefined : (['SUPER_ADMIN', 'ADMIN'] as const);
      const r = await prisma.user.updateMany({
        where: {
          status: 'ACTIVE', deletedAt: null, twoFactorEnabled: false,
          twoFactorGraceUntil: null,
          ...(roles ? { role: { in: roles as unknown as never } } : {}),
        },
        data: { twoFactorGraceUntil: addDays(new Date(), cfg.graceDays) },
      });
      granted = r.count;
    }

    await writeAudit({
      actorId: ctx.user.id, action: 'PERMISSION_CHANGE', entityType: 'Setting',
      summary: `Security policy updated — 2FA ${cfg.require2FA ? 'all' : cfg.require2FAForAdmins ? 'admins' : 'off'}, device approval ${cfg.deviceApproval ? 'on' : 'off'}, geo ${cfg.geoRestrict ? cfg.allowedCountries.join('/') : 'off'}`,
    });
    revalidatePath('/admin/security');
    revalidatePath('/', 'layout');

    return {
      ok: true,
      message: granted > 0
        ? `Saved. ${granted} ${granted === 1 ? 'person has' : 'people have'} ${cfg.graceDays} days to set up two-factor before being blocked.`
        : 'Saved.',
    };
  } catch (err) { return toActionError(err); }
}

/** Let one person sign in from abroad. */
export async function setForeignAccess(userId: string, allowed: boolean): Promise<PolResult> {
  try {
    const ctx = await ensure('admin.user.manage');
    const u = await prisma.user.update({ where: { id: userId }, data: { allowForeignAccess: allowed }, select: { name: true } });
    await writeAudit({ actorId: ctx.user.id, action: 'PERMISSION_CHANGE', entityType: 'User', entityId: userId, summary: `${allowed ? 'Allowed' : 'Blocked'} overseas sign-in for ${u.name}` });
    revalidatePath('/admin/security');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

/** Sign a device out for good. Used when a phone is lost. */
export async function revokeDevice(id: string): Promise<PolResult> {
  try {
    const ctx = await ensure('admin.user.manage');
    const d = await prisma.trustedDevice.update({ where: { id }, data: { revokedAt: new Date() }, select: { userId: true, label: true } });
    await prisma.session.updateMany({ where: { userId: d.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await writeAudit({ actorId: ctx.user.id, action: 'PERMISSION_CHANGE', entityType: 'User', entityId: d.userId, summary: `Revoked device ${d.label ?? ''} and ended its sessions` });
    revalidatePath('/admin/security');
    return { ok: true, message: 'Device revoked and signed out everywhere.' };
  } catch (err) { return toActionError(err); }
}

/** Give one person a fresh window to enrol in 2FA. */
export async function extendGrace(userId: string, days: number): Promise<PolResult> {
  try {
    const ctx = await ensure('admin.user.manage');
    await prisma.user.update({ where: { id: userId }, data: { twoFactorGraceUntil: addDays(new Date(), Math.min(30, Math.max(1, days))) } });
    await writeAudit({ actorId: ctx.user.id, action: 'PERMISSION_CHANGE', entityType: 'User', entityId: userId, summary: `Extended the 2FA grace period by ${days} days` });
    revalidatePath('/admin/security');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}
