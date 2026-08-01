import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth/current-user';
import { AppShell } from '@/components/layout/app-shell';
import { EMPTY_TOP_NAV_PREFS } from '@/lib/nav/top-nav-prefs';

/**
 * The demo workspace shell.
 *
 * Deliberately a SEPARATE route group from `(app)`. The app layout sends every
 * guest here unconditionally; because this layout is not that one, the redirect
 * cannot re-enter itself and cannot loop. It also means no real-data query
 * (projects, active project, nav prefs) exists on a guest's path at all — the
 * shell below is handed empty lists rather than being trusted to filter.
 *
 * Real staff may visit /demo too, which is useful for showing the product to a
 * prospect without handing over a login. Either way the pages underneath read
 * only sandbox tables.
 */
export default async function DemoLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireAuth().catch(() => ({ user: null }) as { user: null });
  if (!user) redirect('/login');

  return (
    <AppShell
      user={{ id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl, role: user.role, designation: user.designation }}
      permissionKeys={[]}
      isSuperAdmin={false}
      navPrefs={{ pinned: [], order: [], hidden: [], collapsed: [], groups: [] }}
      topNavPrefs={EMPTY_TOP_NAV_PREFS}
      projects={[]}
      activeProjectId={null}
      activeProjectName="Demo workspace"
      isGuest
    >
      {children}
    </AppShell>
  );
}
