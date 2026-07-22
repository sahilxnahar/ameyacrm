/**
 * The current app version and a short, human "what changed" list per release.
 * The What's-new panel shows the top entry once, when the version a person last
 * saw (stored on their device) is older than this one. Keep each line plain and
 * benefit-first — this is read by everyone, not just the person who built it.
 */
export const APP_VERSION = 'v14.27';

export interface Release {
  version: string;
  date: string;
  highlights: string[];
}

export const CHANGELOG: Release[] = [
  {
    version: 'v14.27',
    date: '22 Jul 2026',
    highlights: [
      'Forward an email into a chat: paste a screenshot or attach a file to any message.',
      'Language: switch to हिन्दी from the Display menu — menus and common labels translate (more rolling out).',
    ],
  },
  {
    version: 'v14.26',
    date: '22 Jul 2026',
    highlights: [
      'New Messages — chat anyone in the company by name or @username, instead of internal email.',
      'Tag people with @username (with autocomplete); they get notified. Full chat history is kept.',
    ],
  },
  {
    version: 'v14.25',
    date: '21 Jul 2026',
    highlights: [
      'New Site Telemetry — register sensors, trackers and meters, and see their live readings on one dashboard.',
      'Devices send data to a secure endpoint; a "test reading" lets you try it before any hardware arrives.',
    ],
  },
  {
    version: 'v14.24',
    date: '21 Jul 2026',
    highlights: [
      'New Vendor Portal — send a supplier a secure read-only link to see their orders, bills and payments, no login needed.',
    ],
  },
  {
    version: 'v14.23',
    date: '21 Jul 2026',
    highlights: [
      'A better uploader: live progress bars, image previews, paste a screenshot, size checks, and one-tap retry.',
      'Make it yours: pick an accent colour (gold, emerald, indigo, teal or rose) alongside text size and density.',
    ],
  },
  {
    version: 'v14.22',
    date: '21 Jul 2026',
    highlights: [
      'A more premium look and feel — softer card depth, buttons that respond to your press, and KPIs that count up with a little trend line.',
    ],
  },
  {
    version: 'v14.21',
    date: '21 Jul 2026',
    highlights: [
      'New AI Assistant — draft messages, explain terms, summarise and think through next steps.',
      'It uses your AI provider and its backup keys, and says so plainly if no key is set yet.',
    ],
  },
  {
    version: 'v14.20',
    date: '21 Jul 2026',
    highlights: [
      'Records now connect: a work request links to the lead or unit it’s about, and to the task it creates.',
      'A "Related activity" panel shows everything linked to a record, in one place.',
    ],
  },
  {
    version: 'v14.19',
    date: '21 Jul 2026',
    highlights: [
      'Systems now talk to each other: raising a work request notifies the receiving department automatically.',
      'Sturdier under the hood — if one part has trouble, the rest of the page keeps working instead of breaking.',
    ],
  },
  {
    version: 'v14.18',
    date: '21 Jul 2026',
    highlights: [
      'Work Requests — ask another department to get something done, and track it from raised to confirmed.',
      'Each request has an owner, a due date, a full history, and can spawn a task for the receiving team.',
      'Faster behind the scenes: slow queries are now logged, and lead-score insights are computed in the database.',
    ],
  },
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
