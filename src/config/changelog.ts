/**
 * The current app version and a short, human "what changed" list per release.
 * The What's-new panel shows the top entry once, when the version a person last
 * saw (stored on their device) is older than this one. Keep each line plain and
 * benefit-first — this is read by everyone, not just the person who built it.
 */
export const APP_VERSION = 'v14.17';

export interface Release {
  version: string;
  date: string;
  highlights: string[];
}

export const CHANGELOG: Release[] = [
  {
    version: 'v14.17',
    date: '21 Jul 2026',
    highlights: [
      'A “＋ New” button in the top bar — start a lead, task, payment or note from any screen.',
      'Tell us what you think: a feedback button on every page.',
      'Every empty screen now explains what belongs there and how to add the first one.',
      'Money and dates read the way you say them — ₹1.2 Cr, “3 days ago”.',
      '“How this works” help on the more technical screens.',
      'Recently viewed — jump back to the leads, bookings and documents you just opened.',
    ],
  },
  {
    version: 'v14.16',
    date: '21 Jul 2026',
    highlights: [
      'Search understands plain words now — try “invoice”, “escrow” or “who owns the land”.',
      'Text size and density controls in the top bar, for easier reading.',
      'On a phone, long tables now show as tidy cards instead of scrolling sideways.',
      'A consistent colour for every status, and a confirm step before anything is deleted.',
    ],
  },
];
