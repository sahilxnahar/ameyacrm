/**
 * The current app version and a short, human "what changed" list per release.
 * The What's-new panel shows the top entry once, when the version a person last
 * saw (stored on their device) is older than this one. Keep each line plain and
 * benefit-first — this is read by everyone, not just the person who built it.
 */
export const APP_VERSION = 'v14.42';

export interface Release {
  version: string;
  date: string;
  highlights: string[];
}

export const CHANGELOG: Release[] = [
  {
    version: 'v14.42',
    date: '22 Jul 2026',
    highlights: [
      'New “Explore Features” button in the top bar (and in the menu): a searchable map of everything the CRM can do, grouped by area, with a plain-language line on each — click any card to jump straight there.',
      'It only shows what you’re allowed to open, so it doubles as a guide for new team members.',
    ],
  },
  {
    version: 'v14.41',
    date: '22 Jul 2026',
    highlights: [
      'WhatsApp via your own OpenWA gateway, now matched to the self-hosted OpenWA API (X-API-Key + session id): the CRM sends real WhatsApp reminders and broadcasts with no Meta approval and no 24-hour window.',
      'Set three values (URL, key, session id) and every WhatsApp reminder/broadcast routes through it; System Health shows WhatsApp connected.',
    ],
  },
  {
    version: 'v14.40',
    date: '22 Jul 2026',
    highlights: [
      'WhatsApp via your own OpenWA gateway: point the CRM at a self-hosted OpenWA and it sends real WhatsApp reminders and broadcasts — no Meta approval, no template review, no 24-hour window.',
      'Automatic: once OpenWA is set, every WhatsApp reminder and broadcast goes through it, and System Health shows WhatsApp as connected.',
    ],
  },
  {
    version: 'v14.39',
    date: '22 Jul 2026',
    highlights: [
      'A path bar at the top of every screen (like Google Drive) shows exactly where you are — and each part is clickable, so going back a step is one tap.',
    ],
  },
  {
    version: 'v14.38',
    date: '22 Jul 2026',
    highlights: [
      'Real-time ready: chat and notifications can now update instantly the moment something happens, instead of checking every few seconds.',
      'It switches on by adding one small realtime service (see REALTIME-SETUP.md) — until then everything works exactly as before, just via gentle polling.',
      'Fully safe: polling stays as a backup, and a realtime hiccup can never slow down or break sending a message or raising an alert.',
    ],
  },
  {
    version: 'v14.37',
    date: '22 Jul 2026',
    highlights: [
      'Under the hood: added automated tests that lock in the recent fixes — unread-message counting, robust payment-import rules, and background-tab polling — so a future change can’t quietly break them.',
    ],
  },
  {
    version: 'v14.36',
    date: '22 Jul 2026',
    highlights: [
      'Safer payment imports: a bad row is now reported with the row number and reason instead of being silently dropped, and one broken row no longer stops the whole import — the good rows still go in.',
      'Clearer import summary: imported, new payees, skipped and failed are counted separately.',
      'Cleaner merges: merging two payees now moves every reference (payments, bills, POs, emails, ledger entries) and removes the duplicate in a single all-or-nothing step, so a merge can never leave things half-done.',
    ],
  },
  {
    version: 'v14.35',
    date: '22 Jul 2026',
    highlights: [
      'New Notifications inbox (My Day → Notifications): every alert in one place — filter by All/Unread or by type, click to jump to the exact record, and mark read.',
      'One signal you can trust: chat @mentions and cross-department alerts now respect your notification preferences and quiet-hours, and can push — just like every other alert.',
      'The bell now has a “See all in the inbox” link.',
    ],
  },
  {
    version: 'v14.34',
    date: '22 Jul 2026',
    highlights: [
      'Smoother screens: Messages, Vendor Ledgers, Site Telemetry, Work Requests and the Assistant now show a tidy loading placeholder while they open — matching the rest of the app instead of flashing blank.',
    ],
  },
  {
    version: 'v14.33',
    date: '22 Jul 2026',
    highlights: [
      'New System Health board (Team & Admin): one green/amber/red view of the database, schema, and every integration — plus live numbers and links to the deeper Performance and AI Health pages.',
    ],
  },
  {
    version: 'v14.32',
    date: '22 Jul 2026',
    highlights: [
      'Safer under load: the newest endpoints — telemetry ingestion, file-upload tokens and chat sends — are now rate-limited so none can be hammered or abused.',
      'The guard fails open, so a database hiccup never blocks a genuine request.',
    ],
  },
  {
    version: 'v14.31',
    date: '22 Jul 2026',
    highlights: [
      'Less lag: Messages and Site Telemetry now load in a single database pass instead of one query per conversation or device — noticeably snappier.',
      'Calmer in the background: chat and the notification bell stop polling when the tab isn’t in front, and refresh the instant you come back.',
    ],
  },
  {
    version: 'v14.30',
    date: '22 Jul 2026',
    highlights: [
      'A calmer menu: collapse the sidebar to a slim icon rail (like Google’s consoles) and give the page more room — one tap, and it remembers your choice.',
      'Hover any icon in the collapsed rail to see its name; expand again whenever you like.',
      'Tidier sections and spacing throughout the menu so it’s easier to scan.',
    ],
  },
  {
    version: 'v14.29',
    date: '22 Jul 2026',
    highlights: [
      'Import anything: every upload spot now clearly accepts any file — PDF, HTML, images, CAD, Office, ZIP — up to 100 MB each.',
      'A clear “Import files” heading over the drop area in Documents, so it’s obvious where to bring files in.',
    ],
  },
  {
    version: 'v14.28',
    date: '22 Jul 2026',
    highlights: [
      'Vendor Ledgers — import your payments (CSV/Google Sheet) and get a ledger per payee, with bank details.',
      'Two names that are the same person? Merge their ledgers into one.',
      'The "Install app" prompt now has a "Not now" and stops nagging.',
    ],
  },
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
