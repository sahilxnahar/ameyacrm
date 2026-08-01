/**
 * Guest ("demo") mode.
 *
 * A guest uses the real CRM — the same top bar, navigation, search, tour and
 * theme as everyone else — but every screen they can reach is backed by their
 * own private sandbox instead of company data.
 *
 * The isolation rule is simple and absolute: **a guest only ever renders routes
 * under `/demo`.** Those pages read Sandbox* tables exclusively. A real page is
 * never invoked for a guest, so there is no query to get wrong and no `where`
 * clause to forget. The layout enforces this with one unconditional redirect,
 * which is default-deny: any screen added later is outside the demo until
 * somebody deliberately builds a sandbox-backed version of it.
 */

export const DEMO_ROOT = '/demo';

export function isGuestRole(role: string | null | undefined): boolean {
  return role === 'GUEST';
}

/** Is this path inside the demo area a guest is confined to? */
export function isDemoPath(pathname: string): boolean {
  return pathname === DEMO_ROOT || pathname.startsWith(`${DEMO_ROOT}/`);
}

/**
 * The demo's own navigation. Mirrors the real module row so the product feels
 * identical, but every href stays inside `/demo`.
 */
export const DEMO_NAV: Array<{ href: string; label: string; icon: 'home' | 'leads' | 'units' | 'tasks' | 'books' }> = [
  { href: '/demo', label: 'Overview', icon: 'home' },
  { href: '/demo/sales', label: 'Sales', icon: 'leads' },
  { href: '/demo/inventory', label: 'Inventory', icon: 'units' },
  { href: '/demo/tasks', label: 'Tasks', icon: 'tasks' },
  { href: '/demo/tally', label: 'Ameya Tally', icon: 'books' },
];
