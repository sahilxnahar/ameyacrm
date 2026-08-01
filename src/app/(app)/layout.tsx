import { SchemaWarning } from '@/components/layout/schema-warning';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth/current-user';
import { getSecurityPolicy, mustEnroll2FA } from '@/lib/auth/policy';
import { AppShell } from '@/components/layout/app-shell';
import { TwoFactorReminder } from '@/components/layout/two-factor-reminder';
import { readPrefs } from '@/lib/nav/prefs';
import { getNavPrefsRow } from '@/server/services/nav-prefs-service';
import { getActiveProject } from '@/server/services/active-project-service';
import { prisma } from '@/lib/db/prisma';
import { env } from '@/config/env';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, permissions } = await requireAuth();

  // Guest / preview accounts get a sealed, data-free experience. We return here
  // BEFORE any real query (projects, nav prefs, active project) runs, so a guest
  // request never even fetches real company data.
  // A guest can never render a real workspace screen. /preview now lives OUTSIDE
  // this route group, so this redirect can never re-enter this layout — the
  // previous version redirected to a page inside (app) and, whenever the
  // x-pathname header was absent, looped forever ("webpage not working").
  // This is unconditional: no header dependency, no loop, default-deny.
  if (user.role === 'GUEST') {
    redirect('/preview');
  }

  const row = await getNavPrefsRow(user.id);
  const navPrefs = readPrefs(row?.navPrefs);
  const [active, projects] = await Promise.all([
    getActiveProject(user.id),
    prisma.project.findMany({ where: { isActive: true }, select: { id: true, name: true, code: true }, orderBy: { name: 'asc' } }),
  ]);

  // 2FA is still required, but we no longer trap people on the security page on
  // every visit. They land on their home screen; a dismissible reminder shows
  // here and a periodic email nudge (see the daily cron) does the enforcing.
  // Enrolled users compute `false` and never see the reminder.
  const needsTwoFactor = mustEnroll2FA(user, await getSecurityPolicy());

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
      projects={projects}
      activeProjectId={active.id}
      activeProjectName={active.name}
    >
      <SchemaWarning />
      <TwoFactorReminder show={needsTwoFactor} />
      {children}
    </AppShell>
  );
}
