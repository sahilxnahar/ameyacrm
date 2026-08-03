/**
 * What each part of the CRM looks like: its colour, and how much room it gets.
 *
 * Client-safe — no server imports — because the sidebar, the launchpad, the
 * dashboard and the page headers all read from here.
 *
 * ── Why colour ──────────────────────────────────────────────────────────────
 *
 * There are 122 screens. A menu where every row is the same weight of the same
 * brass makes a person read every label every time; nobody navigates by reading,
 * they navigate by recognising. Giving each area of the business a fixed colour
 * means "money is red" becomes true everywhere it appears — the menu group, the
 * tile on the launchpad, the rule under the page title — so within a week you
 * are aiming at a colour, not searching for a word.
 *
 * The colours are chosen to sit under the brass brand rather than compete with
 * it: muted, mid-saturation, all legible as text on both the cream and the
 * charcoal background. They are accents, never fills — the page stays calm.
 *
 * ── Why size ────────────────────────────────────────────────────────────────
 *
 * Equal-sized tiles say every feature matters equally, which is false and makes
 * a 122-tile grid unreadable. Weight says what to look at first: the things a
 * developer touches daily are large, the quarterly ones are small. `weight` is
 * a default — a person can override it per tile and it is stored against their
 * account, because whose day revolves around what differs by role.
 */

export type ModuleTone =
  | 'money' | 'sales' | 'build' | 'legal' | 'people'
  | 'documents' | 'insight' | 'marketing' | 'admin' | 'day';

/** How much space a tile takes on the launchpad and the dashboard. */
export type Weight = 'hero' | 'large' | 'medium' | 'small';

export interface ToneStyle {
  /** Plain name, shown in the customiser. */
  label: string;
  /** Tailwind-ready classes. Kept as literals so the JIT compiler can see them. */
  text: string;
  bg: string;
  border: string;
  /** A solid dot / bar, for the menu group rail and the tile corner. */
  dot: string;
  /** Soft wash behind a large tile. */
  wash: string;
  ring: string;
}

export const TONES: Record<ModuleTone, ToneStyle> = {
  // Money is red on purpose. It is the area where a mistake costs the most, and
  // red is the one colour every person in an office already reads as "money,
  // pay attention" without being taught.
  money: {
    label: 'Money — red',
    text: 'text-rose-700 dark:text-rose-300',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/35',
    dot: 'bg-rose-600',
    wash: 'from-rose-500/12 to-transparent',
    ring: 'ring-rose-500/30',
  },
  sales: {
    label: 'Sales — emerald',
    text: 'text-emerald-700 dark:text-emerald-300',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/35',
    dot: 'bg-emerald-600',
    wash: 'from-emerald-500/12 to-transparent',
    ring: 'ring-emerald-500/30',
  },
  build: {
    label: 'Build & site — amber',
    text: 'text-amber-700 dark:text-amber-300',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/35',
    dot: 'bg-amber-600',
    wash: 'from-amber-500/12 to-transparent',
    ring: 'ring-amber-500/30',
  },
  legal: {
    label: 'Land & legal — indigo',
    text: 'text-indigo-700 dark:text-indigo-300',
    bg: 'bg-indigo-500/10',
    border: 'border-indigo-500/35',
    dot: 'bg-indigo-600',
    wash: 'from-indigo-500/12 to-transparent',
    ring: 'ring-indigo-500/30',
  },
  people: {
    label: 'People & team — violet',
    text: 'text-violet-700 dark:text-violet-300',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/35',
    dot: 'bg-violet-600',
    wash: 'from-violet-500/12 to-transparent',
    ring: 'ring-violet-500/30',
  },
  documents: {
    label: 'Documents — slate',
    text: 'text-slate-700 dark:text-slate-300',
    bg: 'bg-slate-500/10',
    border: 'border-slate-500/35',
    dot: 'bg-slate-600',
    wash: 'from-slate-500/12 to-transparent',
    ring: 'ring-slate-500/30',
  },
  insight: {
    label: 'Insights — cyan',
    text: 'text-cyan-700 dark:text-cyan-300',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/35',
    dot: 'bg-cyan-600',
    wash: 'from-cyan-500/12 to-transparent',
    ring: 'ring-cyan-500/30',
  },
  marketing: {
    label: 'Marketing — fuchsia',
    text: 'text-fuchsia-700 dark:text-fuchsia-300',
    bg: 'bg-fuchsia-500/10',
    border: 'border-fuchsia-500/35',
    dot: 'bg-fuchsia-600',
    wash: 'from-fuchsia-500/12 to-transparent',
    ring: 'ring-fuchsia-500/30',
  },
  admin: {
    label: 'Admin — stone',
    text: 'text-stone-700 dark:text-stone-300',
    bg: 'bg-stone-500/10',
    border: 'border-stone-500/35',
    dot: 'bg-stone-600',
    wash: 'from-stone-500/12 to-transparent',
    ring: 'ring-stone-500/30',
  },
  // "My Day" keeps the house brass: it is the one section that is about you
  // rather than about a part of the business.
  day: {
    label: 'My day — brass',
    text: 'text-brass',
    bg: 'bg-primary/10',
    border: 'border-primary/35',
    dot: 'bg-[hsl(var(--brass))]',
    wash: 'from-primary/12 to-transparent',
    ring: 'ring-primary/30',
  },
};

/** Menu group → tone. The group name is the key used in `navigation.ts`. */
export const GROUP_TONE: Record<string, ModuleTone> = {
  'My Day': 'day',
  'Sales & Leads': 'sales',
  'Inventory & Bookings': 'sales',
  'Marketing': 'marketing',
  'Money': 'money',
  'Build & Site': 'build',
  'Land, Lease & Legal': 'legal',
  'Documents': 'documents',
  'Insights & Reports': 'insight',
  'Team & Admin': 'admin',
};

/**
 * Per-screen weight, where the default for the group is not right.
 *
 * Only the exceptions are listed. Anything absent takes `DEFAULT_WEIGHT` for its
 * group, and anything a person sets for themselves beats both.
 */
export const SCREEN_WEIGHT: Record<string, Weight> = {
  // The daily spine of the business.
  '/finance': 'hero',
  '/dashboard': 'hero',
  '/today': 'hero',
  '/sales': 'hero',
  '/billing': 'hero',

  '/inventory': 'large',
  '/payments': 'large',
  '/receivables': 'large',
  '/tally': 'large',
  '/demands': 'large',
  '/tasks': 'large',
  '/approvals': 'large',
  '/command-center': 'large',
  '/site-ops': 'large',
  '/ra-bills': 'large',
  '/documents': 'large',
  '/reports': 'large',
  '/customers': 'large',
  '/land': 'large',
  '/team': 'large',

  // Genuinely occasional — quarterly filings, one-off tools, registers you open
  // when something specific happens.
  '/capital-gains': 'small',
  '/heir-mapper': 'small',
  '/estamps': 'small',
  '/ip-registry': 'small',
  '/uan-validator': 'small',
  '/welfare-log': 'small',
  '/glossary': 'small',
  '/voice-note': 'small',
  '/scan': 'small',
  '/parking': 'small',
  '/piece-rate': 'small',
  '/vendor-insolvency': 'small',
  '/land-conversion': 'small',
  '/arbitration': 'small',
  '/appellate-litigation': 'small',
  '/transmittals': 'small',
  '/data-quality': 'small',
  '/telemetry': 'small',
  '/social-accounts': 'small',
  '/marketing/audit': 'small',
  '/updates': 'small',
  '/feedback': 'small',
  '/tools': 'small',
};

/** What a screen gets when it is not named above. */
export const DEFAULT_WEIGHT: Weight = 'medium';

/** Grid spans per weight, for the bento launchpad. */
export const WEIGHT_SPAN: Record<Weight, string> = {
  hero: 'col-span-2 row-span-2',
  large: 'col-span-2 row-span-1',
  medium: 'col-span-1 row-span-1',
  small: 'col-span-1 row-span-1',
};

/** Minimum tile height per weight. Small tiles are deliberately squat. */
export const WEIGHT_HEIGHT: Record<Weight, string> = {
  // These pair with the launchpad's 5.5rem grid rows and 0.75rem gap: a
  // two-row tile gets 5.5 + 0.75 + 5.5 = 11.75rem. Setting them independently
  // is what made hero tiles clip their own description.
  hero: 'min-h-[11.75rem]',
  large: 'min-h-[5.5rem]',
  medium: 'min-h-[5.5rem]',
  small: 'min-h-[5.5rem]',
};

export const WEIGHT_LABEL: Record<Weight, string> = {
  hero: 'Hero — biggest',
  large: 'Large — double width',
  medium: 'Medium',
  small: 'Small — compact row',
};

export const WEIGHT_ORDER: Weight[] = ['hero', 'large', 'medium', 'small'];

/** Resolve a screen's tone, honouring a personal override. */
export function toneFor(group: string, href: string, overrides?: Record<string, ModuleTone>): ModuleTone {
  return overrides?.[href] ?? GROUP_TONE[group] ?? 'day';
}

/** Resolve a screen's weight, honouring a personal override. */
export function weightFor(href: string, overrides?: Record<string, Weight>): Weight {
  return overrides?.[href] ?? SCREEN_WEIGHT[href] ?? DEFAULT_WEIGHT;
}

export function toneStyle(tone: ModuleTone): ToneStyle {
  return TONES[tone] ?? TONES.day;
}

/** Longest-prefix map from a URL to its tone, built once from the navigation. */
let _pathTone: Array<[string, ModuleTone]> | null = null;

/**
 * Which colour the page at this URL belongs to.
 *
 * Derived from the navigation rather than hand-listed, so a screen added to a
 * group is automatically the right colour with no second place to update.
 * Longest prefix wins, so `/marketing/audit` resolves before `/marketing`.
 */
export function toneForPath(pathname: string, nav: Array<{ label: string; items: Array<{ href: string }> }>): ModuleTone {
  if (!_pathTone) {
    const rows: Array<[string, ModuleTone]> = [];
    for (const g of nav) {
      const tone = GROUP_TONE[g.label] ?? 'day';
      for (const i of g.items) rows.push([i.href, tone]);
    }
    rows.sort((a, b) => b[0].length - a[0].length);
    _pathTone = rows;
  }
  for (const [href, tone] of _pathTone) {
    if (pathname === href || pathname.startsWith(href + '/')) return tone;
  }
  return 'day';
}
