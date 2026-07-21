import 'server-only';
import { cache } from 'react';
import { prisma } from '@/lib/db/prisma';

export interface SecurityPolicy {
  require2FA: boolean;              // everyone must enrol
  require2FAForAdmins: boolean;     // admins must enrol
  graceDays: number;                // days a new account has before 2FA is enforced
  deviceApproval: boolean;          // an unknown device must be confirmed by email
  geoRestrict: boolean;             // refuse sign-in from outside allowedCountries
  allowedCountries: string[];
  breachCheck: boolean;             // refuse passwords found in known breaches
  stepUp: boolean;                  // re-enter password before dangerous actions
  alertNewDevice: boolean;          // email the person when a new device signs in
  sessionHours: number;
}

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];

/**
 * The defaults are the strict ones that were actually asked for: everyone on
 * two-factor after a week's grace, sign-in from India only, and a emailed code
 * the first time a new device is used.
 *
 * None of these can lock the last administrator out:
 *   · the country check never refuses when the country is unknown, and any
 *     individual can be given `allowForeignAccess` for travel;
 *   · the grace period means nobody is stopped on day one;
 *   · every one of these is a switch in Admin > Security Policy.
 */
export const DEFAULT_POLICY: SecurityPolicy = {
  require2FA: true,
  require2FAForAdmins: true,
  graceDays: 7,
  deviceApproval: true,
  geoRestrict: true,
  allowedCountries: ['IN'],
  breachCheck: true,
  stepUp: true,
  alertNewDevice: true,
  sessionHours: 12,
};

const truthy = (v: unknown) => v === true || v === 'true' || v === 1;

/** Reads the policy. Never throws — a settings failure must not break sign-in. */
export const getSecurityPolicy = cache(async (): Promise<SecurityPolicy> => {
  try {
    const row = await prisma.setting.findUnique({ where: { key: 'security.policy' } });
    if (row?.value && typeof row.value === 'object') {
      const v = row.value as Partial<SecurityPolicy>;
      return {
        ...DEFAULT_POLICY,
        ...v,
        allowedCountries: Array.isArray(v.allowedCountries) && v.allowedCountries.length
          ? v.allowedCountries.map((c) => String(c).toUpperCase())
          : DEFAULT_POLICY.allowedCountries,
      };
    }
    // Fall back to the two older individual settings if the combined one is absent.
    const rows = await prisma.setting.findMany({ where: { key: { in: ['security.require2FA', 'security.require2FAForAdmins'] } } });
    const map = new Map(rows.map((r) => [r.key, r.value as unknown]));
    return {
      ...DEFAULT_POLICY,
      require2FA: truthy(map.get('security.require2FA')),
      require2FAForAdmins: truthy(map.get('security.require2FAForAdmins')),
    };
  } catch {
    return DEFAULT_POLICY;
  }
});
/**
 * Must this person set up 2FA before they can carry on?
 *
 * Honours the grace period: someone required to enrol is nudged but not blocked
 * until their window closes. Nobody is locked out on their first morning.
 */
export function mustEnroll2FA(
  user: { role: string; twoFactorEnabled: boolean; twoFactorGraceUntil?: Date | null },
  policy: SecurityPolicy,
): boolean {
  if (user.twoFactorEnabled) return false;
  const required = policy.require2FA || (policy.require2FAForAdmins && ADMIN_ROLES.includes(user.role));
  if (!required) return false;
  if (user.twoFactorGraceUntil && user.twoFactorGraceUntil > new Date()) return false;
  return true;
}

/** True when 2FA is required but the person still has time. */
export function inGracePeriod(
  user: { role: string; twoFactorEnabled: boolean; twoFactorGraceUntil?: Date | null },
  policy: SecurityPolicy,
): boolean {
  if (user.twoFactorEnabled) return false;
  const required = policy.require2FA || (policy.require2FAForAdmins && ADMIN_ROLES.includes(user.role));
  return required && Boolean(user.twoFactorGraceUntil && user.twoFactorGraceUntil > new Date());
}

/** Is this country allowed for this person? Unknown country is never a refusal. */
export function countryAllowed(
  country: string | null,
  user: { allowForeignAccess?: boolean },
  policy: SecurityPolicy,
): boolean {
  if (!policy.geoRestrict) return true;
  if (user.allowForeignAccess) return true;
  if (!country) return true;
  return policy.allowedCountries.includes(country);
}
