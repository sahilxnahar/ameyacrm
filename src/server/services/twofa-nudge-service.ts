import 'server-only';
import type { RoleName } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { env } from '@/config/env';
import { sendEmail } from '@/lib/email/email';
import { getSecurityPolicy } from '@/lib/auth/policy';

const KEY = 'security.2fa-nudge'; // one Setting row holds { userId: lastSentISO }
const ADMIN_ROLES: RoleName[] = ['SUPER_ADMIN', 'ADMIN'];

/**
 * Email everyone who still hasn't enabled 2FA, at most once every `everyDays`
 * (default 2). Runs from the daily cron. Throttling is stored in a single
 * Setting row, so there is no schema change. Never throws.
 */
export async function run2faNudges(now: Date, everyDays = 2): Promise<{ sent: number; skipped: number }> {
  try {
    const policy = await getSecurityPolicy();
    if (!policy.require2FA && !policy.require2FAForAdmins) return { sent: 0, skipped: 0 };

    // Who is required to have it: everyone, or just admins.
    const roleFilter = policy.require2FA ? {} : { role: { in: ADMIN_ROLES } };
    const users = await prisma.user.findMany({
      where: { status: 'ACTIVE', twoFactorEnabled: false, ...roleFilter },
      select: { id: true, name: true, email: true },
    });
    if (users.length === 0) {
      await prisma.setting.upsert({ where: { key: KEY }, update: { value: {} }, create: { key: KEY, value: {} } }).catch(() => undefined);
      return { sent: 0, skipped: 0 };
    }

    const row = await prisma.setting.findUnique({ where: { key: KEY } }).catch(() => null);
    const last: Record<string, string> =
      row?.value && typeof row.value === 'object' && !Array.isArray(row.value) ? (row.value as Record<string, string>) : {};
    const cutoff = now.getTime() - everyDays * 86400000;
    const link = `${env.APP_URL.replace(/\/$/, '')}/settings/security?enroll=1`;

    let sent = 0;
    let skipped = 0;
    const next: Record<string, string> = {};

    for (const u of users) {
      const prevIso = last[u.id];
      const prev = prevIso ? Date.parse(prevIso) : 0;
      if (prev && prev > cutoff) { next[u.id] = prevIso!; skipped++; continue; }

      const res = await sendEmail({
        to: [u.email],
        subject: 'Action needed: set up two-factor on your Ameya Heights CRM',
        text: `Hello ${u.name ?? ''},\n\nYour account still needs two-factor authentication, which is required on this CRM. It takes about a minute:\n${link}\n\n— Ameya Heights CRM`,
        html:
          `<p>Hello ${u.name ?? ''},</p>` +
          `<p>Your account still needs <strong>two-factor authentication</strong>, which is required on this CRM. It takes about a minute.</p>` +
          `<p><a href="${link}" style="display:inline-block;padding:10px 18px;background:#A07D34;color:#fff;border-radius:6px;text-decoration:none">Set up 2FA</a></p>` +
          `<p>— Ameya Heights CRM</p>`,
      });
      if (res.ok) { next[u.id] = now.toISOString(); sent++; } else { skipped++; }
    }

    await prisma.setting.upsert({ where: { key: KEY }, update: { value: next }, create: { key: KEY, value: next } }).catch(() => undefined);
    return { sent, skipped };
  } catch {
    return { sent: 0, skipped: 0 };
  }
}
