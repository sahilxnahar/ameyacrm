// Client-safe shapes for the customisable top navigation (no server imports).

export interface NavPin {
  /** Where it goes. Always an in-app path, never an external URL. */
  href: string;
  label: string;
  /** What it points at, so the row can show a sensible icon. */
  kind: 'screen' | 'ledger' | 'project' | 'report';
}

export interface TopNavPrefs {
  /** Default modules the user has switched off. */
  hidden: string[];
  /** The user's own pinned targets, in the order they chose. */
  pins: NavPin[];
  /** Preferred order of the default modules, by href. */
  order: string[];
}

export const EMPTY_TOP_NAV_PREFS: TopNavPrefs = { hidden: [], pins: [], order: [] };

export const MAX_PINS = 12;

/**
 * Read whatever is in the JSON column into a shape the UI can trust.
 *
 * Anything unrecognised is dropped rather than rendered: this value is written
 * by the client, so it is treated as untrusted input on the way back in. In
 * particular an href must be an in-app absolute path — allowing `//evil.com`
 * or a `javascript:` URL here would put an attacker-controlled link into the
 * chrome of every page.
 */
export function readTopNavPrefs(raw: unknown): TopNavPrefs {
  if (!raw || typeof raw !== 'object') return EMPTY_TOP_NAV_PREFS;
  const o = raw as Record<string, unknown>;
  const strs = (v: unknown, cap: number) =>
    Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && isSafeHref(x)))].slice(0, cap) : [];

  const pins: NavPin[] = Array.isArray(o.pins)
    ? o.pins
        .filter((p): p is Record<string, unknown> => !!p && typeof p === 'object')
        .map((p) => ({
          href: typeof p.href === 'string' ? p.href : '',
          label: typeof p.label === 'string' ? p.label.trim().slice(0, 40) : '',
          kind: (['screen', 'ledger', 'project', 'report'] as const).includes(p.kind as NavPin['kind'])
            ? (p.kind as NavPin['kind'])
            : 'screen',
        }))
        .filter((p) => p.label.length > 0 && isSafeHref(p.href))
        .slice(0, MAX_PINS)
    : [];

  return { hidden: strs(o.hidden, 40), pins, order: strs(o.order, 40) };
}

/**
 * An in-app path only: must start with a single "/" and must not begin "//"
 * (protocol-relative, which leaves the site) or contain a scheme.
 */
export function isSafeHref(href: string): boolean {
  if (typeof href !== 'string' || href.length === 0 || href.length > 200) return false;
  if (!href.startsWith('/')) return false;
  if (href.startsWith('//')) return false;
  if (href.includes(':')) return false; // javascript:, data:, http:
  if (href.includes('\\')) return false;
  return true;
}
