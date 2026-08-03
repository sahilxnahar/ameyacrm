import { SchemaWarning } from '@/components/layout/schema-warning';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth/current-user';
import { getSecurityPolicy, mustEnroll2FA } from '@/lib/auth/policy';
import { AppShell } from '@/components/layout/app-shell';
import { TwoFactorReminder } from '@/components/layout/two-factor-reminder';
import { EmailDormantBanner } from '@/components/layout/email-dormant-banner';
import { readPrefs } from '@/lib/nav/prefs';
import { getNavPrefsRow } from '@/server/services/nav-prefs-service';
import { readTopNavPrefs } from '@/lib/nav/top-nav-prefs';
import { navModeFromCookie, NAV_MODE_COOKIE } from '@/lib/nav/nav-mode-shared';
import { cookies } from 'next/headers';
import { getActiveProject } from '@/server/services/active-project-service';
import { prisma } from '@/lib/db/prisma';
import { env } from '@/config/env';
import { DEMO_ROOT } from '@/lib/guest/guest-mode';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, permissions } = await requireAuth();

  // ── Guest ("demo") mode ────────────────────────────────────────────────────
  //
  // A guest gets the REAL CRM chrome — this same shell, navigation, search and
  // tour — but is confined to `/demo`, whose pages read only that guest's
  // sandbox tables. Confining by route rather than filtering queries is what
  // makes this safe: a real page component is never invoked for a guest, so
  // there is no query that could return company data.
  //
  // Default-deny: a screen added later is outside the demo until somebody
  // deliberately builds a sandbox-backed version of it.
  // The redirect is UNCONDITIONAL and depends on no header, because `/demo`
  // lives outside this route group. Re-entering this layout is therefore
  // impossible, so there is nothing to loop on — the failure mode that produced
  // "webpage not working" was a guard that redirected back into its own layout.
  const guest = user.role === 'GUEST';
  if (guest) redirect(DEMO_ROOT);

  // ── Nothing below this line may take the whole app down ────────────────────
  //
  // This layout wraps every signed-in route, and an error thrown HERE is not
  // caught by this segment's own error boundary — it bubbles to the root one,
  // which replaces the entire page with "Something went wrong" and no way out.
  // So one missing database column (`User.topNavPrefs`, say, after a deploy
  // without its migration) took down all 200 screens at once, including every
  // screen carrying the Repair button that fixes it. The recovery tool sat
  // behind the failure it recovers from, and the only route left was the
  // address bar.
  //
  // Everything the layout reads is therefore optional. If the database is
  // behind, you get default navigation, no project switcher and a red banner
  // telling you exactly what is missing — a degraded CRM instead of no CRM.
  const row = await getNavPrefsRow(user.id).catch(() => null);
  const navPrefs = readPrefs(row?.navPrefs);
  const topNavPrefs = readTopNavPrefs(row?.topNavPrefs);
  const navMode = navModeFromCookie((await cookies()).get(NAV_MODE_COOKIE)?.value);
  const [active, projects] = await Promise.all([
    getActiveProject(user.id).catch(() => ({ id: null, name: 'All projects' })),
    prisma.project
      .findMany({ where: { isActive: true }, select: { id: true, name: true, code: true }, orderBy: { name: 'asc' } })
      .catch(() => [] as { id: string; name: string; code: string }[]),
  ]);

  // 2FA is still required, but we no longer trap people on the security page on
  // every visit. They land on their home screen; a dismissible reminder shows
  // here and a periodic email nudge (see the daily cron) does the enforcing.
  // Enrolled users compute `false` and never see the reminder.
  const needsTwoFactor = mustEnroll2FA(user, await getSecurityPolicy().catch(() => null) ?? { require2FA: false, require2FAForAdmins: false } as never);

  // F-21 / F-10: loop-SAFE enforcement.
  // Only redirect when we can positively confirm the current path AND that it is
  // not already the security page. If the x-pathname header is absent for any
  // reason (proxy/edge quirk), we DO NOT redirect — availability wins over
  // enforcement, and a missing header must never cause a redirect loop. Users are
  // still nudged by the on-screen reminder below. Turn on hard 2FA via ENFORCE_2FA.
  const pathname = (await headers()).get('x-pathname') ?? '';
  const knownPath = pathname.startsWith('/');
  const onSecurity = pathname.startsWith('/settings/security');
  if (knownPath && !onSecurity) {
    if (user.mustChangePassword) redirect('/settings/security?force=1');
    if (needsTwoFactor && env.ENFORCE_2FA) redirect('/settings/security?enroll=1');
  }

  return (
    <AppShell
      user={{ id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl, role: user.role, designation: user.designation }}
      permissionKeys={[...permissions.keys]}
      isSuperAdmin={permissions.isSuperAdmin}
      navPrefs={navPrefs}
      topNavPrefs={topNavPrefs}
      navMode={navMode}
      projects={projects}
      activeProjectId={active.id}
      activeProjectName={active.name}
    >
      <SchemaWarning />
      <TwoFactorReminder show={needsTwoFactor} />
      <EmailDormantBanner show={env.EMAIL_PROVIDER === 'console' && permissions.keys.has('admin.setting.manage')} />
      {children}
    </AppShell>
  );
}
