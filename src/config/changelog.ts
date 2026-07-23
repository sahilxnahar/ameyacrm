/**
 * The current app version and a short, human "what changed" list per release.
 * The What's-new panel shows the top entry once, when the version a person last
 * saw (stored on their device) is older than this one. Keep each line plain and
 * benefit-first — this is read by everyone, not just the person who built it.
 */
export const APP_VERSION = 'v14.69';

export interface Release {
  version: string;
  date: string;
  highlights: string[];
}

export const CHANGELOG: Release[] = [
  {
    version: 'v14.69',
    date: '23 Jul 2026',
    highlights: [
      'Undo instead of confirm: deleting a recurring payment now shows a “Deleted · Undo” message you can reverse in a tap, rather than a pop-up asking “are you sure?”.',
      'Mobile: a payee’s ledger now has a sticky action bar at the bottom — “Add a payment” and “Passbook” are always in thumb reach without scrolling up.',
    ],
  },
  {
    version: 'v14.68',
    date: '23 Jul 2026',
    highlights: [
      'Mobile: Vendor Ledgers now show payees and each payment as clean stacked cards instead of a table that scrolled sideways off the screen.',
      'Mobile: a one-time hint helps you discover the “+” quick-action button.',
    ],
  },
  {
    version: 'v14.67',
    date: '23 Jul 2026',
    highlights: [
      'Mobile: pull down from the top of any screen to refresh its data — the standard phone gesture, now everywhere.',
    ],
  },
  {
    version: 'v14.66',
    date: '23 Jul 2026',
    highlights: [
      'Mobile: a floating “+” button puts the things you create most — record a payment, add a lead, log a visit, capture a photo, voice note — two taps away from any screen.',
      'Mobile: pop-ups now slide up from the bottom as thumb-reachable sheets instead of appearing mid-screen.',
      'Mobile: the bottom bar now includes Money, so payments are one tap away.',
    ],
  },
  {
    version: 'v14.65',
    date: '23 Jul 2026',
    highlights: [
      'Tell the vendor you’ve paid: tick “WhatsApp the vendor a receipt” when adding a payment and they get an instant “₹X paid, UTR…” message. Plus a one-click passbook (CSV) of any payee’s full ledger to send for reconciliation.',
      'Payment review limit: set a threshold (e.g. ₹5,00,000) and any payment above it is flagged for a second person to approve before it counts.',
      'Advances & retention: mark a payment as an advance and settle it later; hold back retention on a contractor and release it on completion — with running totals per payee.',
      'TDS: record TDS deducted on a payment; the Spend Report now shows total TDS to deposit, plus a statutory due-dates reference (TDS 7th, GSTR 11th/20th, advance tax).',
      'Recurring Payments (Money → Recurring Payments): set salaries, rent, EMIs and subscriptions once; the ones due are flagged, and “Record paid” logs the payment and rolls the date forward.',
      'Bank reconciliation is already built-in under Cash Flow & Treasury — import a statement and it matches each debit to your recorded payments by UTR.',
    ],
  },
  {
    version: 'v14.64',
    date: '23 Jul 2026',
    highlights: [
      'Duplicate-payment guard: when you add a payment, the CRM warns if the same UTR — or the same payee and amount in the last 30 days — was already recorded, so nothing gets entered (or paid) twice.',
      'Vendor Ledgers now show what you still OWE each payee (from unpaid vendor bills) alongside what you’ve paid — plus a “Still owed” total at the top.',
      'Project cost-to-complete: on the Spend Report, a per-project view of budget vs committed (POs) vs spent, and what’s left to complete.',
    ],
  },
  {
    version: 'v14.63',
    date: '23 Jul 2026',
    highlights: [
      'Tidy up payees: on Vendor Ledgers, tap “Tidy up payees”, tick every line that’s really the same person (all the “Arun” rows, etc.), choose the name to keep, and merge them into one ledger. You can also rename any payee.',
      'Every payment now has a category — Materials, Labour & sub-contractors, Approvals & statutory fees, Professional fees, Overheads — set automatically from the note and changeable per payment.',
      'New Spend Report (Money → Spend Report): see where the money went by category, by project, by payee and by month, with a one-click CSV export.',
      'Your existing payments are auto-categorised by the accompanying database update, so the report is populated from day one.',
    ],
  },
  {
    version: 'v14.62',
    date: '23 Jul 2026',
    highlights: [
      'Vendor Ledgers now show the full story of every payment: date, mode, UTR/reference, and the note (what it was for) — all in one row, like a passbook.',
      'Add a payment by hand right inside a payee’s ledger — amount, date, mode, UTR and note — no CSV needed. It’s tagged to your current project so it also shows on Payments Made.',
      'Attach proof to any payment: upload the phone screenshot or bank PDF (with the UTR) against each payment, and open it later with one click.',
      'Payments Made no longer hides imported payments: payments not tagged to a project now show under any project instead of vanishing — so your ₹65 L of expenses appear where you expect.',
    ],
  },
  {
    version: 'v14.61',
    date: '23 Jul 2026',
    highlights: [
      'Channel-partner sign-ups from the website now flow straight into the CRM: when someone registers as a channel partner on ameyaheights.com, they appear in Channel Partners as a Pending partner and admins get a notification — no more copying names out of an email.',
      'On the Channel Partners page, admins get a “Get website registrations here automatically” panel with the exact web address to point the website form at.',
    ],
  },
  {
    version: 'v14.60',
    date: '23 Jul 2026',
    highlights: [
      'Enter a bill by hand — no AI needed: the bill importer now has an “Enter the bill by hand” option, so you can add a bill directly even when the AI is down or out of credit. You type the vendor, GST, date and lines; the CRM does the maths and saves it.',
      'The bill importer is always open now (it no longer greys out when AI is unavailable), because the by-hand path always works.',
    ],
  },
  {
    version: 'v14.59',
    date: '23 Jul 2026',
    highlights: [
      'One-tap updates: when a new version goes live, a slim bar appears at the top — tap “Update now” and you’re on the latest in seconds. No deleting the app, no reinstalling, no re-downloading everything. Works on phones too.',
      'Add your own projects: Admin → Projects (also “+ New project” in the project switcher at the top) lets an admin create a new development — name it, give it a city and RERA number — and it instantly shows up for everyone to work under.',
      'No more wrong turns on imports: if you drop a spreadsheet on the AI bill reader, it now points you straight to Vendor Ledgers, which is the right place for a whole list of expenses.',
    ],
  },
  {
    version: 'v14.58',
    date: '23 Jul 2026',
    highlights: [
      'The map now loads reliably everywhere — the map engine ships inside the app instead of being fetched from an outside link, so a strict network, ad-blocker or firewall can no longer stop it from opening.',
      'Drag & drop is now on every import: just drop a CSV or Excel file onto Vendor Ledgers, Lead import, or a bank statement — or drop a bill onto the AI bill reader — no more hunting for a file button.',
    ],
  },
  {
    version: 'v14.57',
    date: '23 Jul 2026',
    highlights: [
      'Messages and the Assistant are now one tap away from every screen — new icons in the top bar, so you never have to scroll or hunt for them.',
    ],
  },
  {
    version: 'v14.56',
    date: '23 Jul 2026',
    highlights: [
      'Finished work stops nagging you: once you mark your part of a task complete (or reject it), it no longer emails you or shows up as pending — even if the whole task is still open for others.',
      'Today’s Priorities is now in sync — it drops assignments you’ve completed, so it reflects what’s genuinely still on your plate.',
    ],
  },
  {
    version: 'v14.55',
    date: '23 Jul 2026',
    highlights: [
      'Your Profile is now editable: set a profile photo, and add your phone and WhatsApp number. Your role is shown too, so you know what you can do.',
    ],
  },
  {
    version: 'v14.54',
    date: '23 Jul 2026',
    highlights: [
      'The “Ameya Heights” wordmark is now crisp and readable in light mode (it was washed out); dark mode is unchanged.',
    ],
  },
  {
    version: 'v14.53',
    date: '22 Jul 2026',
    highlights: [
      'Import Excel directly: the payments/ledger import, lead import and treasury import now accept .xlsx (and .xls) files, not just CSV — no more converting to CSV first.',
      'Your Excel files are read in the browser and turned into rows automatically; the first sheet is used.',
    ],
  },
  {
    version: 'v14.52',
    date: '22 Jul 2026',
    highlights: [
      'New Guide (top of the menu, and on your Home page): a proper onboarding guidebook — first steps, how to make it yours, and a walk through every department and feature, all searchable.',
      'Perfect for new joiners: it shows the areas each person’s role can access, so it’s a tailored “how to use the CRM” for everyone.',
    ],
  },
  {
    version: 'v14.51',
    date: '22 Jul 2026',
    highlights: [
      'Minimise Home sections: each segment on the dashboard (At a glance, Needs attention, Tasks & files) now has a heading you can click to fold it away — remembered per person, so everyone shapes their own Home.',
    ],
  },
  {
    version: 'v14.50',
    date: '22 Jul 2026',
    highlights: [
      'The AI Assistant now lives right on your Home dashboard, docked on the right — draft, ask or summarise without leaving the page (it moves below the dashboard on smaller screens).',
    ],
  },
  {
    version: 'v14.49',
    date: '22 Jul 2026',
    highlights: [
      'New “What’s New” page (Team & Admin): a searchable log of every feature and update we’ve ever shipped — type to find anything by name or by what it does.',
      'System Health now shows Maps correctly as working — it uses OpenStreetMap and needs no key, so it was wrongly flagged as “not configured”.',
    ],
  },
  {
    version: 'v14.48',
    date: '22 Jul 2026',
    highlights: [
      'New “Easy view” — one tap in the Display menu sets the roomy spacing and larger text together, for anyone who finds the app busy. “Standard” puts it back.',
    ],
  },
  {
    version: 'v14.47',
    date: '22 Jul 2026',
    highlights: [
      'Quick-jump search (⌘K / the top-bar search) now shows your Recent screens the moment it opens — so hopping back to what you were just doing is one tap, before you type anything.',
    ],
  },
  {
    version: 'v14.46',
    date: '22 Jul 2026',
    highlights: [
      'A softer, more alive feel: pages now ease in gently as you move around, instead of snapping — subtle, and automatically off if you prefer reduced motion.',
    ],
  },
  {
    version: 'v14.45',
    date: '22 Jul 2026',
    highlights: [
      'A real spacing switch (Display menu → Spacing): Compact, Comfortable, or Spacious — and it now changes the whole app, not just tables. Pick Spacious for a roomy, open feel; Compact to fit more on screen.',
      'Combine it with Large text for the most open, easy-to-read layout — remembered on your device.',
    ],
  },
  {
    version: 'v14.44',
    date: '22 Jul 2026',
    highlights: [
      'WhatsApp/OpenWA works cleanly through an ngrok tunnel — server calls skip ngrok’s browser warning so messages always reach your gateway.',
    ],
  },
  {
    version: 'v14.43',
    date: '22 Jul 2026',
    highlights: [
      'A fresh, more premium look — the first step of a full visual refresh: softer rounded cards, crisper depth, and a deeper, cleaner dark mode across the whole app.',
      'Redesigned KPI tiles: bigger numbers, tidy uppercase labels, and a subtle icon watermark — the elevated dashboard style.',
      'More screens will be brought into the same look next.',
    ],
  },
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
