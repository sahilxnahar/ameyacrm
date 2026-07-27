import { SchemaWarning } from '@/components/layout/schema-warning';
import { requireAuth } from '@/lib/auth/current-user';
import { getSecurityPolicy, mustEnroll2FA } from '@/lib/auth/policy';
import { AppShell } from '@/components/layout/app-shell';
import { TwoFactorReminder } from '@/components/layout/two-factor-reminder';
import { readPrefs } from '@/lib/nav/prefs';
import { getNavPrefsRow } from '@/server/services/nav-prefs-service';
import { getActiveProject } from '@/server/services/active-project-service';
import { prisma } from '@/lib/db/prisma';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, permissions } = await requireAuth();
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
