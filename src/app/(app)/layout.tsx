import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth/current-user';
import { getSecurityPolicy, mustEnroll2FA } from '@/lib/auth/policy';
import { AppShell } from '@/components/layout/app-shell';
import { readPrefs } from '@/lib/nav/prefs';
import { getNavPrefsRow } from '@/server/services/nav-prefs-service';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, permissions } = await requireAuth();
  const row = await getNavPrefsRow(user.id);
  const navPrefs = readPrefs(row?.navPrefs);

  // Mandatory-2FA gate: if policy requires it and the user hasn't enrolled, force setup.
  const pathname = (await headers()).get('x-pathname') || '';
  if (pathname && !pathname.startsWith('/settings/security')) {
    if (mustEnroll2FA(user, await getSecurityPolicy())) redirect('/settings/security?enroll=1');
  }

  return (
    <AppShell
      user={{ name: user.name, email: user.email, avatarUrl: user.avatarUrl, role: user.role, designation: user.designation }}
      permissionKeys={[...permissions.keys]}
      isSuperAdmin={permissions.isSuperAdmin}
      navPrefs={navPrefs}
    >
      {children}
    </AppShell>
  );
}
