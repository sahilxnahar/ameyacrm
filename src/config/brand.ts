/**
 * Ameya Heights — Brand configuration (single source of truth).
 *
 * Extracted verbatim from the official Ameya Heights Brand Kit. Nothing here is
 * invented. Every color/font/asset used in the UI is derived from this file so
 * the brand can be re-skinned globally by editing ONE place (see also
 * `globals.css`, which mirrors these tokens as CSS variables, and
 * `tailwind.config.ts`, which consumes those variables).
 *
 * Source: "Ameya Heights — Complete Brand Kit" (00_README.md, ameya_logo/README.txt)
 */
export const brand = {
  company: {
    legalName: 'Ameya Heights LLP',
    displayName: 'Ameya Heights',
    founder: 'Sangvi Sahil Nahar',
    website: 'https://www.ameyaheights.com',
    tagline: 'Building Spaces. Shaping Legacies.',
    // RERA registration is IN PROGRESS per brand kit — keep this flag until registered.
    reraRegistered: false,
    reraNote: 'RERA registration in progress',
  },
  /** Raw hex palette straight from the brand kit. */
  colors: {
    charcoal: '#100F0D',
    ink: '#16140F',
    brass: '#A07D34',
    brassDeep: '#8C6E2C',
    brassLight: '#C2A05B',
    sand: '#ECE7DF',
    goldDark: '#9A7720',
    goldLight: '#C9A95D',
    // Semantic status colors (kept in-family / accessible)
    success: '#2E7D32',
    warning: '#C9A95D',
    danger: '#9B111E',
    info: '#1B2A4A',
  },
  fonts: {
    display: 'Cormorant Garamond', // serif — headings / hero
    body: 'Inter', // sans — UI / body
    accent: 'Unbounded', // display — sparing accent use
  },
  assets: {
    markGoldDark: '/brand/mark-gold-dark.svg',
    markWhite: '/brand/mark-white.svg',
    lockupGoldDark: '/brand/lockup-gold-dark.svg',
    lockupWhite: '/brand/lockup-white.svg',
    banner: '/brand/banner.svg',
    appIcon: '/icons/icon.svg',
  },
} as const;

export type Brand = typeof brand;
