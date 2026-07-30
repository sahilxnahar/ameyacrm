import { SchemaWarning } from '@/components/layout/schema-warning';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth/current-user';
import { getSecurityPolicy, mustEnroll2FA } from '@/lib/auth/policy';
import { AppShell } from '@/components/layout/app-shell';
import { GuestShell } from '@/components/layout/guest-shell';
import { TwoFactorReminder } from '@/components/layout/two-factor-reminder';
import { readPrefs } from '@/lib/nav/prefs';
import { getNavPrefsRow } from '@/server/services/nav-prefs-service';
import { getActiveProject } from '@/server/services/active-project-service';
import { prisma } from '@/lib/db/prisma';
import { env } from '@/config/env';

// Routes a GUEST / preview account may reach. Everything else redirects to the
// sample-data showcase. Default-DENY: if a screen isn't on this list it is never
// reachable, so no real-data page can render for a guest even by direct URL.
const GUEST_ALLOW = ['/preview'];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, permissions } = await requireAuth();

  // Guest / preview accounts get a sealed, data-free experience. We return here
  // BEFORE any real query (projects, nav prefs, active project) runs, so a guest
  // request never even fetches real company data.
  if (user.role === 'GUEST') {
    const pathname = (await headers()).get('x-pathname') ?? '';
    const allowed = GUEST_ALLOW.some((p) => pathname === p || pathname.startsWith(p + '/'));
    if (!allowed) redirect('/preview');
    return <GuestShell name={user.name}>{children}</GuestShell>;
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

  // F-21 / F-10: loop-safe enforcement. The security page is exempt so users can
  // actually fix these there without redirecting onto itself.
  const pathname = (await headers()).get('x-pathname') ?? '';
  const onSecurity = pathname.startsWith('/settings/security');
  if (!onSecurity) {
    // Forced password change is enforced unconditionally (only set intentionally).
    if (user.mustChangePassword) redirect('/settings/security?force=1');
    // Mandatory 2FA is enforced only when the org has switched it on (ENFORCE_2FA).
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
