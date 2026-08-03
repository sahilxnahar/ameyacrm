import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { PUBLIC_PATHS, isPublicPath } from '@/lib/auth/public-paths';

/**
 * The middleware's allow-list, guarded from both directions.
 *
 * Too short and a recovery path dies silently: a password-reset or invitation
 * link bounces to `/login`, which is the one screen that person cannot get
 * past, and being redirected to a login page looks like the system working.
 * Too long — or matched by raw `startsWith` — and a signed-in screen quietly
 * falls out of the gate, which is how `/pay` came to cover `/payments`.
 */
const root = path.resolve(__dirname, '..');

describe('middleware public paths', () => {
  it('lets every signed-out auth screen through', () => {
    const screens = readdirSync(path.join(root, 'src/app/(auth)'), { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => `/${d.name}`);
    expect(screens.length).toBeGreaterThan(4);
    const blocked = screens.filter((s) => !isPublicPath(s));
    expect(blocked, `these signed-out screens redirect to /login: ${blocked.join(', ')}`).toEqual([]);
  });

  it('covers the exact URLs the reset and invitation emails contain', () => {
    // password-reset.ts sends /reset-password?t=…; onboarding-service.ts sends
    // /set-password?token=…. If either stops being public, account recovery and
    // onboarding both die and nothing says so.
    expect(isPublicPath('/reset-password')).toBe(true);
    expect(isPublicPath('/set-password')).toBe(true);
    expect(isPublicPath('/forgot-password')).toBe(true);
  });

  it('lets the token-gated external portals through', () => {
    // Buyers, channel partners, vendors and e-signature recipients have no account.
    for (const p of ['/portal/abc', '/cp/abc', '/vendor-portal/abc', '/sign/abc', '/pay/abc']) {
      expect(isPublicPath(p), `${p} is not public`).toBe(true);
    }
  });

  it('still gates every signed-in screen', () => {
    for (const p of ['/dashboard', '/payments', '/ledgers', '/settings/security', '/admin/permissions', '/tally', '/billing']) {
      expect(isPublicPath(p), `${p} should require a session`).toBe(false);
    }
  });

  it('matches whole segments, so a short prefix cannot swallow a longer route', () => {
    // The bug this replaced: '/pay'.startsWith matched '/payments'.
    expect(isPublicPath('/payments')).toBe(false);
    expect(isPublicPath('/pay')).toBe(true);
    expect(isPublicPath('/signup')).toBe(true);
    expect(isPublicPath('/sign')).toBe(true);
    expect(isPublicPath('/installments')).toBe(false);
    expect(isPublicPath('/setup-wizard')).toBe(false);
    expect(isPublicPath('/portal-admin')).toBe(false);
  });

  it('lists nothing that looks like an app screen', () => {
    const suspicious = PUBLIC_PATHS.filter((p) => ['/admin', '/settings', '/finance', '/dashboard'].some((a) => p.startsWith(a)));
    expect(suspicious).toEqual([]);
  });
});
