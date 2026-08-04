/**
 * One chart system for the whole of Ameya OS.
 *
 * Client-safe — no server imports.
 *
 * ── Why this file exists ────────────────────────────────────────────────────
 *
 * There were four palettes, each defined at the top of the screen that used it
 * and none of them theme-aware. Measured against the six standard checks, all
 * four failed, and not marginally:
 *
 *   reports  BRASS       6 browns; worst adjacent pair ΔE 3.8 for NORMAL vision
 *   dashboard CATEGORICAL 8 slots; worst adjacent ΔE 4.3 (deutan), 13.6 normal
 *   dashboard PIPELINE   7 slots; worst adjacent ΔE 5.9 normal
 *   analytics UNIT_COLORS Tailwind defaults, unrelated to any of the above
 *
 * A "normal vision" ΔE below 15 means a reader with no colour-vision deficiency
 * at all cannot reliably tell two categories apart. At 3.8 they are the same
 * colour. That is not a polish issue — it means a six-category report chart was
 * not conveying six categories to anybody.
 *
 * ── How these values were chosen ────────────────────────────────────────────
 *
 * Not by eye. The hues were walked in OKLCH at fixed lightness and chroma and
 * scored with the palette validator until both modes passed every check:
 *
 *   light (surface #FCFCFB)  worst adjacent ΔE 6.0 deutan · 16.5 normal · all ≥ 3:1
 *   dark  (surface #1B1A18)  worst adjacent ΔE 7.5 deutan · 23.1 normal · all ≥ 3:1
 *
 * Dark is not a flip of light: it is the same eight hues re-stepped to the dark
 * lightness band, which is the only way the contrast-against-surface check can
 * pass in both. Both sit in the 6–8 CVD floor band, which is permitted only
 * with secondary encoding — hence the rule below that every chart with two or
 * more series ships a legend, and four or fewer are direct-labelled too.
 *
 * Brass keeps slot 1 so a single-series chart is still an Ameya chart.
 */

/** Fixed categorical order. Never cycled, never reordered by rank. */
export const CATEGORICAL_LIGHT = [
  '#A8751B', // brass — the house colour keeps slot 1
  '#0F6FA8', // blue
  '#0E8C5F', // green
  '#B85C8E', // pink
  '#3E7CC4', // sky
  '#C4551A', // orange
  '#7A5BAD', // purple
  '#557A22', // olive
] as const;

/** The same eight hues, re-stepped for the charcoal surface. */
export const CATEGORICAL_DARK = [
  '#C27100', '#008DE8', '#00A562', '#D04F99',
  '#2186EE', '#DA5801', '#9867E1', '#619900',
] as const;

/**
 * Magnitude, not identity: one hue, light to dark.
 *
 * Brass, because a heatmap of money should look like the rest of the app. Never
 * use the categorical list for a sequential job — a rainbow ramp implies the
 * categories are ordered when they are not, and hides where the real jumps are.
 */
export const SEQUENTIAL_LIGHT = ['#F3E7CF', '#E0C795', '#C9A55E', '#A8751B', '#7C540F'] as const;
export const SEQUENTIAL_DARK = ['#3A2C13', '#5C441A', '#8A6520', '#B98A2C', '#E0B558'] as const;

/**
 * Polarity: two poles and a neutral middle. Ahead of plan / behind plan,
 * over-recovered / under-recovered. Never a hue at the midpoint.
 */
export const DIVERGING_LIGHT = ['#9E3A2E', '#CE8A7E', '#E8E6E1', '#6E9AB8', '#1F5C80'] as const;
export const DIVERGING_DARK = ['#E0776A', '#B4655C', '#3A3833', '#5E93B4', '#8FC2E0'] as const;

/**
 * State, not series. Reserved: never reuse one of these as "the fourth series",
 * because a reader who has learned that red means overdue will read a red
 * category as overdue. Always shipped with a word or an icon beside them, never
 * colour alone.
 */
export const STATUS = {
  light: { good: '#2F7D46', warning: '#B07A12', serious: '#8F4A16', critical: '#A32C22', neutral: '#6B6459' },
  dark: { good: '#4FAE68', warning: '#D6A03A', serious: '#E07A3C', critical: '#E0655A', neutral: '#A8A093' },
} as const;

export type ChartMode = 'light' | 'dark';

/** The categorical list for a mode. Index by series position, never by rank. */
export function categorical(mode: ChartMode): readonly string[] {
  return mode === 'dark' ? CATEGORICAL_DARK : CATEGORICAL_LIGHT;
}

export function sequential(mode: ChartMode): readonly string[] {
  return mode === 'dark' ? SEQUENTIAL_DARK : SEQUENTIAL_LIGHT;
}

export function diverging(mode: ChartMode): readonly string[] {
  return mode === 'dark' ? DIVERGING_DARK : DIVERGING_LIGHT;
}

/**
 * The colour for series `i`.
 *
 * Beyond the eighth series the answer is not a ninth colour — nine categories
 * on one chart cannot be told apart by anyone, whatever the palette. The caller
 * should fold the tail into "Other" or facet into small multiples; this wraps
 * only so a runaway loop degrades quietly instead of rendering `undefined`.
 */
export function seriesColor(i: number, mode: ChartMode): string {
  const p = categorical(mode);
  return p[i % p.length]!;
}

/**
 * Shared Recharts furniture, so axes and tooltips match on every screen.
 * Recessive: the grid and the axes are not the data.
 */
export const AXIS = {
  stroke: 'hsl(var(--border))',
  tick: { fill: 'hsl(var(--muted-foreground))', fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;

export const GRID = {
  stroke: 'hsl(var(--border))',
  strokeDasharray: '3 3',
  vertical: false,
} as const;

export const TOOLTIP = {
  contentStyle: {
    background: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '0.5rem',
    fontSize: '12px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.07)',
  },
  labelStyle: { color: 'hsl(var(--foreground))', fontWeight: 600 },
  cursor: { fill: 'hsl(var(--muted-foreground))', fillOpacity: 0.06 },
} as const;

/** A bar's data-end is rounded; the baseline end is not. */
export const BAR_RADIUS_VERTICAL: [number, number, number, number] = [4, 4, 0, 0];
export const BAR_RADIUS_HORIZONTAL: [number, number, number, number] = [0, 4, 4, 0];
