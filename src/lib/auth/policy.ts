import 'server-only';
import { prisma } from '@/lib/db/prisma';

export interface SecurityPolicy {
  require2FA: boolean;            // every user must have 2FA
  require2FAForAdmins: boolean;   // Super Admin / Admin must have 2FA
}
const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];
const DEFAULT_POLICY: SecurityPolicy = { require2FA: false, require2FAForAdmins: false };

const truthy = (v: unknown) => v === true || v === 'true' || v === 1;

/** Reads the org security policy from Setting. Never throws — returns defaults on error. */
export async function getSecurityPolicy(): Promise<SecurityPolicy> {
  try {
    const rows = await prisma.setting.findMany({ where: { key: { in: ['security.require2FA', 'security.require2FAForAdmins'] } } });
    const map = new Map(rows.map((r) => [r.key, r.value as unknown]));
    return {
      require2FA: truthy(map.get('security.require2FA')),
      require2FAForAdmins: truthy(map.get('security.require2FAForAdmins')),
    };
  } catch {
    return DEFAULT_POLICY;
  }
}

/** True when this user is required to set up 2FA but hasn't yet. */
export function mustEnroll2FA(user: { role: string; twoFactorEnabled: boolean }, policy: SecurityPolicy): boolean {
  if (user.twoFactorEnabled) return false;
  if (policy.require2FA) return true;
  if (policy.require2FAForAdmins && ADMIN_ROLES.includes(user.role)) return true;
  return false;
}
