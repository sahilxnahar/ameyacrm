/**
 * The current app version and a short, human "what changed" list per release.
 * The What's-new panel shows the top entry once, when the version a person last
 * saw (stored on their device) is older than this one. Keep each line plain and
 * benefit-first — this is read by everyone, not just the person who built it.
 */
export const APP_VERSION = 'v15.98';

export interface Release {
  version: string;
  date: string;
  highlights: string[];
}

export const CHANGELOG: Release[] = [
  {
    version: 'v15.98',
    date: '1 Aug 2026',
    highlights: [
      'Ameya Tally now keeps a full edit log: every voucher created, changed or deleted is recorded with who did it, when, and the exact before-and-after figures. Find it at Gateway \u2192 Audit \u2192 Edit Log.',
      'It cannot be switched off, and no entry can be edited or removed \u2014 which is what the Companies (Accounts) Rules require of accounting software, and what your auditor has to report on. The trail survives even after a voucher is deleted.',
      'Fixed the squashed dashboard tiles on a 13" laptop \u2014 the labels were breaking one letter per line because the row forced five cards into the narrow column beside the Assistant. The tiles now fit themselves to the space actually available.',
      'Run MIGRATION_v15.98_all.sql before deploying this one.',
    ],
  },
  {
    version: 'v15.97',
    date: '1 Aug 2026',
    highlights: [
      'A sweep for anything that could lose an enquiry — 12 faults found and fixed. The worst: on a busy day, portal enquiries past the 50th in a batch were skipped and then never looked at again, because the mail connector moved its marker past them.',
      'A repeat enquiry from someone marked Lost used to become a note on a dead record that appeared in nobody\u2019s list. It now reopens the lead, sets a follow-up for today and tells the owner.',
      'The same buyer arriving as \u201c9840490000\u201d and \u201c+91 98404 90000\u201d is now recognised as one person, so two reps no longer ring the same person. You can also finally search for a lead by phone number.',
      'An incoming call from a number nobody recognises now creates a lead instead of being discarded, so first-time callers can be rung back.',
      'The rule that shares out new enquiries never actually worked \u2014 it reported success while assigning nobody, leaving leads invisible to the reps. Fixed, and it now says so loudly when it cannot assign.',
      'Removing a colleague passes their open leads and tasks on, rather than leaving them unowned and unchased. Overdue follow-ups with no owner now reach the sales managers.',
      'The lead board no longer stops at 300; where a list is trimmed, the screen says so instead of quietly hiding the rest.',
      'What\u2019s new was showing an old entry \u2014 it now tracks the version you are actually running.',
    ],
  },
  {
    version: 'v15.96',
    date: '1 Aug 2026',
    highlights: [
      'Guest accounts now run inside the real CRM. A guest signs in and gets the same top bar, menu, search and tour as everybody else — but every screen they can open reads their own private sample data, so they can add leads, hold flats, tick off tasks and post journal entries without touching a single real record. Their workspace resets itself daily.',
      'The guided tour now points at what it is describing: the card travels to each menu button and spotlights it, instead of sitting over the middle of the screen.',
      'The top menu is yours to arrange — pin a ledger, a project or any screen you open daily, reorder them, and switch off the modules you never use.',
      'Admin can now add, remove and restore people, and download everybody\u2019s data as a zip (one folder per person, plus a readable spreadsheet). Removing someone keeps their history in the audit trail.',
      'Run MIGRATION_v15.96_all.sql before deploying this one.',
    ],
  },
  {
    version: 'v15.95',
    date: '1 Aug 2026',
    highlights: [
      'A full security and correctness sweep — 13 real faults found and fixed. Two were serious: any admin could reset a super-admin\u2019s password and take over the account, and staff with view-only finance access could delete posted vouchers.',
      'Money and dates: cash receipts would have stopped working entirely once the numbering reached CR-10000; a cancelled voucher left its ledger entry in place, so the cash book and trial balance disagreed; the financial-year profit was adding up everything since day one rather than the year; and “This FY” was leaving out 31 March.',
      'Collections: a small part-payment no longer marks a whole instalment as paid, and a buyer is no longer flagged overdue on the morning the payment is due.',
      'The same flat can no longer be booked twice by two people at once.',
    ],
  },
  {
    version: 'v15.94',
    date: '1 Aug 2026',
    highlights: [
      'Ameya Tally now holds more than one company, so you can import several sets of books and switch between them from the title bar.',
      'Tally import handles the lot: ledgers with opening balances, vouchers, stock items with units and GST, inventory movements, and cost centres — by XML, by CSV, or automatically through the new bridge that runs on your Tally PC.',
      'On a 13" laptop the crowded top bar is split into two rows, so every menu item shows a real label instead of collapsing into icons.',
    ],
  },
  {
    version: 'v15.87',
    date: '28 Jul 2026',
    highlights: [
      'New: a shareable Guest / preview account. Set any user’s role to “Guest” in Admin and you can hand that login to anyone — a prospect, a partner, an investor — to show off the whole platform safely.',
      'A guest sees a polished product showcase with sample data only (no real leads, money, documents, customers or email are ever loaded) and a complete map of every module. It’s sealed three ways: guests can only reach the preview screen, every server action is refused for a guest so nothing can be changed, and the Guest role carries no data permissions at all.',
      'No database change needed for this version. To make a preview login: Admin → Users → add a user → set role to Guest → share the credentials.',
    ],
  },
  {
    version: 'v15.86',
    date: '28 Jul 2026',
    highlights: [
      'A full sweep for the same family of layout problems, so screens hold up from a phone to a 27" monitor without surprises. Fixed: the public floor-plan and buyer-portal tables now scroll instead of crushing or clipping on a phone; the AI bill-import line items, partner payout form, inventory PDF options and cash-book entry form now stack neatly on small screens instead of squeezing their fields.',
      'No database change needed for this version.',
    ],
  },
  {
    version: 'v15.85',
    date: '28 Jul 2026',
    highlights: [
      'Fixed a table layout bug where columns could collapse to a single character wide and stack their text vertically — most visible on the Documents list (Owner / Size / Changed). Tables now keep sensible column widths on every screen; genuinely long values like emails or reference numbers still wrap cleanly. This applies to every table in the app.',
      'No database change needed for this version.',
    ],
  },
  {
    version: 'v15.84',
    date: '28 Jul 2026',
    highlights: [
      'The whole interface now adapts to your screen automatically. Text and spacing scale smoothly with the display — a touch tighter on a phone or 11" tablet, comfortable on a 13" laptop, and larger and roomier on a 27" monitor — instead of only jumping at fixed breakpoints. Your own text-size choice (Small / Medium / Large) still applies on top.',
      'Fixed the crowded top bar. At in-between widths the shortcut labels were squeezing the search box until it collided with the project name. The Messages / Assistant / Tally / Explore shortcuts now stay as clean icons until there’s genuinely room for their labels, so the search bar keeps its space and nothing overlaps.',
      'Wide monitors use more of the screen — content now stretches to a larger, still-comfortable width so a 27" display isn’t mostly empty margins.',
      'No database change needed for this version.',
    ],
  },
  {
    version: 'v15.83',
    date: '28 Jul 2026',
    highlights: [
      'Drag-and-drop now works on every remaining place you attach a file — your profile photo, a floor-plan image, an architecture drawing, a vendor payment proof, the marketing library, and the AI goods-receipt scanner. You can still click to browse exactly as before; dragging is just an added shortcut.',
      'Those attachments now open right there too: the payment proof, the drawing, the floor plan and the GRN scan all show an inline preview (images render, PDFs embed) so you can see what you attached before saving — the GRN scanner now previews PDF challans, not just photos.',
      'No database change needed for this version.',
    ],
  },
  {
    version: 'v15.82',
    date: '28 Jul 2026',
    highlights: [
      'Uploaded documents now open right where you upload them. A new inline viewer shows the actual file — images render, PDFs embed in the page, and everything else gets a one-tap open/download — so you can see what you attached without leaving the screen. It appears automatically under the standard uploader (e.g. filing a record in the Due Diligence vault).',
      'Import a bill and you now see the original bill side-by-side with what the AI read off it — check the vendor, GST and line items against the source before saving, instead of trusting a filename.',
      'The bulk Import wizard now takes a file, not just a paste. Drag in a CSV or Excel file (or paste as before) and it shows a real table preview of your first rows — so you can confirm the columns line up before mapping and importing.',
      'No database change needed for this version.',
    ],
  },
  {
    version: 'v15.81',
    date: '28 Jul 2026',
    highlights: [
      'The whole workspace now breathes. Every page is capped to a comfortable reading width and centred, so on a wide monitor content no longer sprawls edge-to-edge — consistent gutters, less clutter, easier to scan.',
      'The Command Center Alerts board is calmer by default: it now shows only the signals that actually need your attention instead of a wall of green zeros. When everything is clear you get a single “All clear across every engine” card, and a one-tap toggle reveals all the watched signals whenever you want the full picture.',
      'Site Ops (Daily Log) is now reachable — the field diary for weather, labour headcount, notes and milestone-tagged progress photos is live under Build & Site and from the Site Ops launcher tile.',
      'This version needs a small database change — run MIGRATION_v15.81_all.sql in Neon before deploying (adds the Daily Site Log and Site Photo tables; safe to run more than once). If you already ran MIGRATION_v15.80_all.sql, this is a harmless no-op.',
    ],
  },
  {
    version: 'v15.77',
    date: '28 Jul 2026',
    highlights: [
      'A dedicated, print-ready record view for the vault. Open any due-diligence record to a clean document — Ameya Heights letterhead, all the details, verification status and a signatory line — then hit Print: the top-bar, dock, sidebar and watermark texture all drop away and you get a crisp, high-contrast, legal-grade page fit for a court or certifier, with a high-resolution brand watermark behind it.',
      'Polished pulse skeletons now hold the layout for the Launchpad and the vault while they load, so there’s no jump or flash as data arrives.',
      'Under the hood: reusable print utilities strip app chrome on print across the whole product, so any official document view exports cleanly. No database change needed for this version.',
    ],
  },
  {
    version: 'v15.76',
    date: '28 Jul 2026',
    highlights: [
      '⌘K now knows the government portals. Type “CMDA”, “Bhoomi”, “K-RERA” or “MP Bhulekh” and the palette offers two actions per authority — Open the official portal in a new tab, or File a record from it, which jumps straight into the vault with the right authority expanded and the upload box already active.',
      'Due-diligence expiry alerts are now click-through. The Command Center tile for an expiring encumbrance certificate or town-planning approval links directly to that exact record in the vault, which highlights and scrolls to it — no hunting. Powered by the same URL-parameter routing between palette, alerts and the vault.',
      'No database change needed for this version.',
    ],
  },
  {
    version: 'v15.75',
    date: '27 Jul 2026',
    highlights: [
      'The Due Diligence Vault now covers far more record types — fire NOC, airport-height and environment clearances, water and electricity approvals, and the Tamil-Nadu land set (patta, chitta, adangal, FMB, survey sketch, NA order) alongside the existing RERA, EC and land-title records.',
      'A new reusable uploader powers the vault: drag-and-drop on desktop, native camera/photo-library on mobile, strict PDF/JPEG/PNG validation, duplicate detection and clean toasts — no layout shift. The Command Palette and alert tiles can now deep-link straight into it (e.g. open a specific authority with the upload box already active) via URL parameters.',
      'This version needs a small database change — run MIGRATION_v15.75_all.sql in Neon before deploying (adds the new record-type values).',
    ],
  },
  {
    version: 'v15.74',
    date: '27 Jul 2026',
    highlights: [
      'Ameya OS Launchpad, phase 2. The Command Center now opens on an app grid — the Core 8: Finance & Tax, Site Ops & 4D BIM, Legal & Due Diligence, Vendor & Labour, Sales & CRM, Procurement & Inventory, Corporate Approvals and System Settings — each a big touch target with a live red badge counting what needs attention in that domain.',
      'Type to filter apps instantly (press “/” to focus), and the Bento alert board sits right below. Badges roll up the real signals — GST/MSME issues, pending sign-offs, labour gaps, buyer demands, material gates, corporate approvals — so the number on a card is the number of things waiting for you.',
      'No database change needed for this version.',
    ],
  },
  {
    version: 'v15.73',
    date: '27 Jul 2026',
    highlights: [
      'Ameya OS shell, phase 1. A new desktop Top-Bar carries the Ameya Heights logo mark, the project selector, a universal Upload button and ⌘K search; on phones it gives way to a fixed bottom Dock with four big touch targets — Launchpad, Search, Quick-Upload and Alerts — sized for one-handed use on site.',
      'The brand watermark is now a reusable component with a crisp high-resolution variant for official document and report views (RA bills, demand letters, certifier sign-offs) alongside the faint workspace texture — brand identity stays 100% intact across every screen.',
      'The transition is additive: the existing sidebar remains the desktop navigation fallback, so all 187 screens keep working exactly as before while the new shell rolls in. No database change needed for this version.',
    ],
  },
  {
    version: 'v15.72',
    date: '27 Jul 2026',
    highlights: [
      'New Pan-India Due Diligence & RERA Vault (Land, Lease & Legal). A searchable directory of every state and local authority portal — RERA, land records (Bhoomi, Mahabhulekh, Patta Chitta, Apna Khata, MP Bhulekh), registration (Kaveri, IGR, TNREGINET), and town-planning/municipal/hill bodies (DTCP, CMDA, PMRDA, PMC/PCMC, BDA, BBMP, BMRDA, IDA, DDA, HACA) — across Tamil Nadu, Madhya Pradesh, Rajasthan, Maharashtra, Karnataka and Delhi/NCR.',
      'Click any authority to open its official portal in a new tab, then drag the downloaded PDF (or photograph it on mobile) straight into the vault, filed against a project with its record type, reference and validity. Type “CMDA”, “Kodaikanal HACA” or “Indore Bhulekh” to filter instantly.',
      'Encumbrance certificates and town-planning approvals are watched for expiry — anything past its validity, or older than six months without one, surfaces as a yellow tile on the Command Center for the liaison team. Reachable from ⌘K and the Launchpad.',
      'This version needs a small database change — run MIGRATION_v15.72_all.sql in Neon before deploying (adds the due-diligence record table and record-type enum).',
    ],
  },
  {
    version: 'v15.71',
    date: '27 Jul 2026',
    highlights: [
      'Email is now per-user. New Email Integration settings (My Day) let every team member connect their own IMAP inbox — enter your email, host and app-password, test the connection, and your mail syncs into the CRM under your account rather than everyone sharing one generic mailbox.',
      'Your app-password is encrypted at rest with the app key and never shown again. If you don’t connect your own, the CRM still falls back to the shared org mailbox, so nothing breaks for existing users. The Gmail/IMAP inbox screen now reads whichever mailbox is yours.',
      'This version needs a small database change — run MIGRATION_v15.71_all.sql in Neon before deploying (adds encrypted per-user IMAP fields to the user record).',
    ],
  },
  {
    version: 'v15.70',
    date: '27 Jul 2026',
    highlights: [
      'GSTR-2B reconciliation is now real. Upload the GSTR-2B export (CSV or Excel) by drag-and-drop and every supplier invoice is auto-matched against your vendor bills — matched, amount-mismatch, or missing — so you catch a supplier who hasn’t filed before you claim the Input Tax Credit. Mismatches surface as a red tile on the Command Center, and a daily job keeps the matching current.',
      'New Revenue Recognition screen (Money) exposes the IND-AS 115 POCM engine that was previously backend-only — snapshot a project’s percentage of completion and see cumulative and incremental revenue, never over-recognising past 100%.',
      'The UAN validator now takes a CSV/Excel upload as well as pasted text, using the same universal drag-and-drop file picker. An internal audit this cycle found the GSTR-2B and revenue screens missing and the file-upload path unwired on these forms — all now closed.',
      'No database change needed for this version.',
    ],
  },
  {
    version: 'v15.69',
    date: '27 Jul 2026',
    highlights: [
      'New BOCW Labour Camp & Creche Welfare Log (Build & Site). Record the statutory welfare facilities — drinking water, medical camp, creche and sanitation — with a headcount and photo, as the evidence a labour inspector asks for.',
      'Any required facility not logged for a project this month is flagged as a compliance gap on the screen and surfaced as a red tile on the Command Center — so a BOCW audit never finds a surprise. This completes Priority-2.',
      'This version needs a small database change — run MIGRATION_v15.69_all.sql in Neon before deploying (adds the welfare-log table).',
    ],
  },
  {
    version: 'v15.68',
    date: '27 Jul 2026',
    highlights: [
      'New EPF/ESI UAN Bulk Validator (Build & Site). Paste a contractor’s labour roster and every 12-digit Universal Account Number is format-checked instantly — an invalid UAN is flagged before the worker is let through the gate, so EPF/ESI coverage is confirmed at the checkpoint, not discovered in an audit.',
      'Re-pasting a roster updates rather than duplicates, and invalid UANs surface as a red tile on the Command Center. Ready for a live EPFO/GSP (Karza/Signzy) confirmation layer when you connect one. This is Priority-2 module #68.',
      'This version needs a small database change — run MIGRATION_v15.68_all.sql in Neon before deploying (adds the labour-UAN table).',
    ],
  },
  {
    version: 'v15.67',
    date: '27 Jul 2026',
    highlights: [
      'Payment reminders now speak the buyer’s language. Set a buyer’s preferred language — English, हिन्दी, ಕನ್ನಡ or தமிழ் — right on the Payment Demands screen, and every WhatsApp and email reminder to them goes out in it, using reviewed templates (not risky live translation) for the four core languages.',
      'For any other language an AI translation is attempted, and if that ever fails the message falls back to English — so a translation hiccup can never stop a reminder going out. This completes Priority-1 module #6 — all six Core engines are now shipped and green.',
      'This version needs a small database change — run MIGRATION_v15.67_all.sql in Neon before deploying (adds a preferred-language field to the buyer record).',
    ],
  },
  {
    version: 'v15.66',
    date: '27 Jul 2026',
    highlights: [
      'New Piece-Rate Labour Billing (Build & Site). Bill specialised sub-contractors on measured output — square feet plastered, tiled, waterproofed — rather than fixed attendance. Enter quantity × rate and settle in a click, which raises the payment voucher on the money spine (no parallel table). A frozen or deactivated vendor can’t be settled.',
      'New Sub-Contractor Default Registry. A cross-project record of abandonment, QA failures, delays and safety lapses; flagging a vendor as blacklisted deactivates them across every project at once, and blacklisted vendors surface as a red tile on the Command Center.',
      'Priority-1 module #5 of the Core 6 — with this, five of the six Core engines are shipped (only the multilingual WhatsApp layer remains).',
      'This version needs a small database change — run MIGRATION_v15.66_all.sql in Neon before deploying (adds the piece-rate and vendor-default tables).',
    ],
  },
  {
    version: 'v15.65',
    date: '27 Jul 2026',
    highlights: [
      'New 4D BIM & Construction Timeline Sync (Build & Site). Register a 3D model per tower and break it into construction phases; mark a phase complete — a slab cast, a floor topped out — and if it’s wired to a buyer payment milestone, that milestone is brought due so the dunning engine raises the demand automatically. Physical progress becomes a cash-flow trigger.',
      'Each model shows a live progress bar, and demand-linked phases are called out. Optional Autodesk Platform Services (Forge) viewer URN per model. Priority-1 module #4 of the Core 6.',
      'This version needs a small database change — run MIGRATION_v15.65_all.sql in Neon before deploying (adds the BIM model and phase tables).',
    ],
  },
  {
    version: 'v15.64',
    date: '27 Jul 2026',
    highlights: [
      'New Independent Certifier Portal (Build & Site). A dedicated queue showing every active structural contract awaiting an independent engineer’s monthly sign-off — clear a month in one click and that contractor’s RA-bill payment is released, all through the same certification gate the settlement action already enforces server-side.',
      'Pending sign-offs surface on the Command Center and the portal is reachable from ⌘K. No new database tables — this is a purpose-built lens over the existing certification engine. Priority-1 module #3 of the Core 6.',
      'No database change needed for this version.',
    ],
  },
  {
    version: 'v15.63',
    date: '27 Jul 2026',
    highlights: [
      'New BBMP / BDA Plan Sanction & FAR Tracker (Land, Lease & Legal). Record the sanctioned FAR/FSI and update the as-built figure as slabs are cast — the deviation percentage recomputes instantly and the Occupancy Certificate is flagged “at risk” the moment built FAR pushes past the tolerance, so a deviation is caught during construction rather than at OC application.',
      'OC-at-risk sanctions surface straight onto the Command Center as a red tile, and the screen is reachable from ⌘K. This is Priority-1 module #2 of the Core 6.',
      'This version needs a small database change — run MIGRATION_v15.63_all.sql in Neon before deploying (adds the plan-sanction table).',
    ],
  },
  {
    version: 'v15.62',
    date: '27 Jul 2026',
    highlights: [
      'New Command Center (My Day) — a clean, card-based Bento overview that pulls the one urgent signal from every operational engine into a single screen: MSME payments about to be disallowed, engineer sign-offs pending, buyer demands queued, vendors frozen by insolvency, permit and trademark renewals, FEMA and hearing deadlines, and the async event queue. Red tiles mean act now.',
      'It carries the new workspace top-nav row — Overview · Sales & CRM · Site & Engineering · Finance & Tax · Legal — and a prominent ⌘K search bar that opens the existing command palette to jump to any unit, booking, voucher or customer instantly.',
      'This is the first step of the consumer-grade UI refresh, shipped alongside the current navigation so nothing breaks — the sleek shell rolls out screen by screen from here.',
      'No database change needed for this version.',
    ],
  },
  {
    version: 'v15.61',
    date: '27 Jul 2026',
    highlights: [
      'New MSME 45-Day Tracker (Money). Every MSME supplier bill runs a live Section 43B(h) countdown and flips to Overdue on its own before the 45-day (or 15-day) window closes — so a late payment never quietly turns into a disallowed tax deduction.',
      'New Capital Gains Simulator (Sales). A front-office calculator that shows a prospective buyer their Section 54 / 54F tax saving from reinvesting sale proceeds into an Ameya Heights home — figures update live and a scenario can be saved to share.',
      'New Khata & EC Vault plus an IND-AS 115 POCM revenue-recognition engine and GSTR-2B reconciliation scaffolding. This is Group 10 (modules 51–55) of the 51–80 build; more groups follow.',
      'This version needs a small database change — run MIGRATION_v15.61_all.sql in Neon before deploying (adds the revenue-recognition, GSTR-2B, MSME-clock, khata and capital-gains tables).',
    ],
  },
  {
    version: 'v15.60',
    date: '27 Jul 2026',
    highlights: [
      'The Legal, IP & Litigation group is complete. New this release: the NRI / FEMA Gateway (FATCA + FEMA for foreign buyers, each inward remittance carrying its 90-day reporting deadline), the Arbitration & ADR docket, e-Stamping (SHCIL-ready, manual until the API is live), and the REAT & High Court appellate docket.',
      'Hearings and FEMA deadlines are swept daily so nothing is missed; e-stamp certificate numbers land automatically through the webhook bus once SHCIL is connected. Settlements and stamp duty converge on vouchers like every other money event.',
      'This completes modules 81–90 — trademark registry, structural-contract & NCLT payment gates, title-chain vault, heir mapper, land conversion, and now NRI/FEMA, arbitration, e-stamping and appellate litigation.',
      'This version needs a small database change — run MIGRATION_v15.60_all.sql in Neon before deploying (adds the NRI, remittance, ADR, e-stamp and appellate-litigation tables).',
    ],
  },
  {
    version: 'v15.59',
    date: '27 Jul 2026',
    highlights: [
      'New Title Chain & Link Document Vault (Land, Lease & Legal). Digitise the 30-year chain of title — mother deed, sale/gift/partition deeds, mutation extracts, EC and RTC/pahani — in one verifiable register, so title due-diligence is a single screen instead of a box of scans.',
      'New JDA Heir Mapper. Map the landowner genealogy and undivided shares behind a joint-development agreement, and record each relinquishment deed — so the JDA is executed by every rightful heir and no succession claim surfaces after signing.',
      'New Land Conversion (ALN) tracker. Move each agricultural parcel through RTC verification, DC scrutiny, the conversion fee and the alienation order, stage by stage — so nothing is built before it is legally converted. Modules 84, 85 and 88 of the Legal group.',
      'This version needs a small database change — run MIGRATION_v15.59_all.sql in Neon before deploying (adds the title-chain, landowner and land-conversion tables).',
    ],
  },
  {
    version: 'v15.58',
    date: '27 Jul 2026',
    highlights: [
      'New Structural Contracts & CLM (Build & Site). Track each structural contractor’s contract, its defect-liability period, and the independent-engineer certification per month — and an uncertified month automatically blocks that contractor’s RA-bill payment, enforced server-side so it can’t be skipped.',
      'New Vendor Insolvency Monitor (Money). Flag a vendor pulled into NCLT / IBC proceedings; a vendor in CIRP or under a s.14 moratorium is frozen the instant you save the flag, and their advances are refused at settlement until it clears — the moratorium enforced in code.',
      'Both gates layer onto the existing labour-compliance gate on the same payment action, so a single RA-bill settlement now checks EPF/ESI, engineer certification, and insolvency together. Modules 82 and 87 of the Legal, IP & Litigation group.',
      'This version needs a small database change — run MIGRATION_v15.58_all.sql in Neon before deploying (adds the structural-contract, engineer-certification and vendor-insolvency tables).',
    ],
  },
  {
    version: 'v15.57',
    date: '27 Jul 2026',
    highlights: [
      'New IP & Trademark Registry (Land, Lease & Legal). Keep every brand mark, its Nice class and its status — Filed, Objected, Registered and so on — in one register, firm-wide or per project.',
      'The 10-year renewal is worked out for you the moment you enter a registration date, and a mark flips itself to “Renewal due” as the deadline nears (checked automatically every day) — so a trademark never lapses because a diary reminder was missed.',
      'A summary board shows what is registered, what needs renewal, and what is under objection or opposition. This is the first module of the Legal, IP & Litigation group (81–90).',
      'This version needs a small database change — run MIGRATION_v15.57_all.sql in Neon before deploying (adds the trademark register tables).',
    ],
  },
  {
    version: 'v15.56',
    date: '27 Jul 2026',
    highlights: [
      'New Payment Demands screen (Money). Every buyer instalment that is due within a week — or already overdue — is turned into a reminder automatically and sent over WhatsApp and email, so collections chase themselves instead of a person chasing a spreadsheet.',
      'Demands are raised once per instalment (no double-texting the same buyer), and the moment a milestone is paid the reminder closes itself — the money still lands on the payment schedule and voucher, never on a second table.',
      'A live board shows outstanding demanded value, what is awaiting dispatch, sent and paid — with “Run demand cycle” and “Re-send pending” for a manual push, and a one-click cancel. Runs every day via the cron, and skips anyone with no phone or email so you can chase them by hand.',
      'This version needs a small database change — run MIGRATION_v15.56_all.sql in Neon before deploying (adds the demand-notice table).',
    ],
  },
  {
    version: 'v15.55',
    date: '27 Jul 2026',
    highlights: [
      'New Integration Events bus (Team & Admin → System health). Every third-party webhook — Razorpay payments, IoT sensors, WhatsApp — now lands in a durable queue, is acknowledged in under 200 ms, and is processed out-of-band, so a slow or flaky partner API can never freeze the CRM.',
      'Razorpay collections post themselves: a captured payment automatically raises the receipt voucher and splits it 70/30 into the RERA and general escrow accounts, with the bank UTR carried through — no manual entry, and it can’t double-post.',
      'A live board shows Pending / Processed / Failed events and total IoT readings, with a one-click “Run worker now” for admins. Failed events retry up to 3× then park for manual replay. This is the core integration layer (module #50) the rest of the PropTech build sits on.',
      'This version needs a small database change — run MIGRATION_v15.55_all.sql in Neon before deploying (adds the webhook-event queue, asset/IoT-reading and escrow-split tables).',
    ],
  },
  {
    version: 'v15.54',
    date: '27 Jul 2026',
    highlights: [
      'New Labour Compliance gate (Build & Site). Flag a vendor as a labour vendor and their RA-bill payments are automatically blocked until that month’s EPF and ESI challans are recorded and verified — no more paying ahead of statutory dues.',
      'Track each vendor’s EPF/ESI challan by month with a clear Cleared / Blocked badge; verifying both releases the payment gate instantly. The block is enforced server-side at settlement, so it can’t be skipped.',
      'This is the reusable “document gate” pattern the ERP will reuse for buyer 194-IA and possession NOCs. Phase 1 of the construction ERP continues.',
      'This version needs a small database change — run MIGRATION_v15.54_all.sql in Neon before deploying (adds the compliance-doc table + a vendor flag).',
    ],
  },
  {
    version: 'v15.53',
    date: '27 Jul 2026',
    highlights: [
      'New RA Bills module (Build & Site) — contractor running-account billing done right. Enter the certified gross value and the CRM works out the 1% BOCW labour cess, retention, and TDS (auto-mapped to 194C, higher rate if no PAN) and shows the exact net payable live as you type.',
      'Certification runs through the existing approval engine: submit a bill to your certifiers in order (Site Engineer → Independent Engineer → Finance); once certified it can be paid in one click, which raises the payment voucher carrying the TDS and retention automatically.',
      'A summary board shows bills awaiting certification, certified-but-unpaid value, cess accrued and retention held. This is Phase 1 of the construction ERP build.',
      'This version needs a small database change — run MIGRATION_v15.53_all.sql in Neon before deploying (adds the RA-bill tables).',
    ],
  },
  {
    version: 'v15.52',
    date: '27 Jul 2026',
    highlights: [
      'New TDS module (Money → TDS). One screen for your whole Tax-Deducted-at-Source position: total liability accrued, total deposited to the government, and what’s still pending — with a colour-coded ledger of every deduction marked Deposited or Pending.',
      'Smart rate calculation: a built-in calculator maps a payment to the right Indian section (194C, 194J, 194I, 194H, 194Q, 195 and more), applies the correct rate — including the higher no-PAN rate under s.206AA — respects the section threshold, and shows the TDS and net payable. Vendors can carry a default section so future payments auto-map.',
      'Bank-account / vendor lookup: search by vendor, bank name, IFSC or account number to pull the full TDS ledger tied to that account, then tick the deducted-but-unpaid entries and mark them deposited with a challan number in one go.',
      'This version needs a small database change — run MIGRATION_v15.52_all.sql in Neon before deploying (adds TDS section + deposit tracking to payments, and a default section on vendors).',
    ],
  },
  {
    version: 'v15.51',
    date: '27 Jul 2026',
    highlights: [
      'Billing now reads at a glance. Invoices, purchase orders and vendor bills are shown as full-width, colour-coded rows instead of cramped tables — each with the party’s monogram, the number, project/due date, a status chip and the amount, with a green/red/amber accent down the left edge so paid, overdue and pending jump out.',
      'Purchase orders waiting for your approval are tinted and keep their one-tap approve/reject buttons right on the row. Invoices still open their PDF on click.',
      'Second of the full-width screen refreshes (after Sales & Leads), using the same shared visual language. No database change.',
    ],
  },
  {
    version: 'v15.50',
    date: '27 Jul 2026',
    highlights: [
      'Sales & Leads now has a full-width List view alongside the board. Switch with the Board/List toggle at the top left: the list uses the whole screen with colour-coded rows — a monogram and name, the reference and project, source, budget, a status chip, and the owner with how long ago it was touched — so you can scan hundreds of leads at a glance instead of squinting at a pipeline.',
      'Rows are colour-coded down the left edge (green won/booked, red lost, amber hot, blue in-progress) and open the lead on click. On a phone the row condenses to the essentials automatically.',
      'This is the first of the full-width screen refreshes; Bookings, Billing and Inventory follow next, using the same visual language. No database change needed.',
    ],
  },
  {
    version: 'v15.49',
    date: '27 Jul 2026',
    highlights: [
      'Tidy-up after the full-width change: the top bar, breadcrumb and page title now line up on the same left edge, and the faint background emblem is centred within the content area instead of drifting left behind the sidebar.',
      'No database change needed for this one.',
    ],
  },
  {
    version: 'v15.48',
    date: '27 Jul 2026',
    highlights: [
      'A visual home. Your home screen now has a “Jump to anything” launcher — big icon tiles for every part of the CRM, grouped like the sidebar and filtered to what you’re allowed to open. One glance, one tap, no menu hunting.',
      'It fills the full width (see v15.47), so the whole system is laid out visually in front of you the moment you sign in.',
      'No database change needed for this one.',
    ],
  },
  {
    version: 'v15.47',
    date: '27 Jul 2026',
    highlights: [
      'The CRM now uses the full width of your screen. Pages were capped to a narrow centred column that left big empty margins on wide monitors; they now stretch to fill the page, so dashboards, tables and lists have room to breathe and less scrolling.',
      'No database change needed for this one.',
    ],
  },
  {
    version: 'v15.46',
    date: '27 Jul 2026',
    highlights: [
      'New Finance Command Center (top of the Money menu). One screen with your cost of capital (total bank/NBFC debt, weighted-average interest rate, interest per month and interest due), your cash position, what’s owed to you and by you, and a 12-week cash runway with a warning if cash is forecast to run negative.',
      'It reads your existing borrowings, bank and billing data, so it’s live the moment you open it.',
      'No database change needed for this one.',
    ],
  },
  {
    version: 'v15.45',
    date: '27 Jul 2026',
    highlights: [
      'New Email Health screen (Team & Admin → “Email Health”). One click checks whether your outbound email actually works and, if a password-reset or 2FA email isn’t arriving, tells you exactly what to fix — wrong provider, app-password format, port/security mismatch, or a rejected sender address.',
      'You can send a real test email to yourself and see the mail server’s exact response, so email problems stop being silent.',
      'No database change needed for this one.',
    ],
  },
  {
    version: 'v15.44',
    date: '27 Jul 2026',
    highlights: [
      'Full Gmail inbox, inside the CRM (My Day → “Gmail (IMAP)”). Reads your mailbox directly over IMAP — the list of recent emails, open any one to read it, reply, or compose a new message — all without opening Gmail. Sending uses your existing email setup; no Google Cloud Console.',
      'To switch it on: enable IMAP in Gmail, create a Google app password, and set IMAP_USER + IMAP_PASS in Vercel (if your SMTP already uses the same mailbox, they’re reused automatically).',
      'No database change needed for this one.',
    ],
  },
  {
    version: 'v15.43',
    date: '27 Jul 2026',
    highlights: [
      'The dashboard no longer clusters on medium screens. The “At a glance” tiles were being crushed (labels stacking one letter per line) when the Assistant panel squeezed the middle. Now the Assistant sits beside the dashboard only on very wide screens and drops below on laptops, and the tiles reflow to fit — so everything stays readable at every size.',
      'No database change needed for this one.',
    ],
  },
  {
    version: 'v15.42',
    date: '27 Jul 2026',
    highlights: [
      'Start a WhatsApp from inside the CRM. “Mail & Inbox” now has a “New WhatsApp” button — send a message to any number (with country code) via your WhatsApp connection, and it appears in the inbox alongside replies.',
      'This completes WhatsApp send + receive: incoming messages already thread in and you could reply; now you can also start a new conversation, without opening WhatsApp separately.',
      'No database change needed for this one.',
    ],
  },
  {
    version: 'v15.41',
    date: '27 Jul 2026',
    highlights: [
      'Google Sheets & Drive, for real (Documents → “Google Sheets & Drive”). One click exports your Leads, Vendors or Bookings into a tab of your linked Google Sheet, and you can browse the files the CRM has saved to your Drive folder.',
      'It runs through your own Apps Script connector — no Google Cloud Console — and shows a live connection status so you know it’s working.',
      'No database change needed for this one.',
    ],
  },
  {
    version: 'v15.40',
    date: '27 Jul 2026',
    highlights: [
      'The App Exchange now tells the truth. Only the apps that genuinely work end-to-end are badged “Live” (messaging, Razorpay, WhatsApp, the property portals, and Gmail/Sheets/Drive via your Apps Script). Every other app is clearly marked “Not built yet” instead of a misleading “Live / syncs both ways”.',
      'Installing a not-built app now plainly says it only records your interest — so nothing pretends to work when it doesn’t. Tell us which apps you actually need and we build them for real, one at a time.',
      'No database change needed for this one.',
    ],
  },
  {
    version: 'v15.39',
    date: '27 Jul 2026',
    highlights: [
      'Gmail, inside the CRM — you can now write and send a brand-new email straight from “Mail & Inbox” (renamed from Shared Inbox), not just reply. Incoming mail already syncs in via your Google Apps Script connector, so this completes the loop: read, reply and compose without leaving the CRM.',
      'The menu now says plainly that this is your email — look under My Day → “Mail & Inbox”.',
      'No database change needed for this one.',
    ],
  },
  {
    version: 'v15.38',
    date: '27 Jul 2026',
    highlights: [
      'New “My Apps” menu (under Team & Admin) — see every app you’ve installed in one place, with quick access to manage each, and a button to browse the App Exchange.',
      'Straight talk on what apps do: “My Apps” now says plainly which connections are live and moving data (Slack, Discord, Telegram, Razorpay, property portals) versus those that are authorised but whose deeper two-way sync is still rolling out.',
      'Fixed the floating Assistant button overlapping buttons on the page, and the notification prompt sitting on top of it — they now keep out of each other’s way, with more breathing room at the bottom of every screen.',
      'No database change needed for this one.',
    ],
  },
  {
    version: 'v15.37',
    date: '27 Jul 2026',
    highlights: [
      'A build fix so the recent updates (borrowings, the tidier Money menu, the Secret Cash Book master erase and the sign-in improvements) all deploy cleanly. No visible change on its own — deploy this one.',
    ],
  },
  {
    version: 'v15.36',
    date: '27 Jul 2026',
    highlights: [
      'Secret Cash Book — a master erase for the owner. Under “Owner controls”, you can wipe the whole book in one step. Before anything is deleted it is safely backed up (encrypted), so a wipe is never final.',
      'Only you (the owner / Super Admin) can do it, and only while the book is unlocked. You confirm by typing ERASE, and if the backup can’t be saved for any reason, nothing is deleted.',
      'Restore any time: “Backups & restore” lists every backup with its date and entry count, and brings the entries back with one click.',
      'No database change needed for this one.',
    ],
  },
  {
    version: 'v15.35',
    date: '27 Jul 2026',
    highlights: [
      'New Borrowings screen (under Money) for loans from banks and NBFCs. Add a facility with its rate, then record each drawdown as the money arrives — interest accrues on a reducing balance from the day of each drawdown, and repayments lower it.',
      'See it at a glance: per lender and across everything — how much you’ve drawn, what’s outstanding, interest accrued so far, interest paid, and what interest is still due — plus your balance-weighted average rate and your interest cost per month.',
      'The Money menu is tidier: everyday items (Billing, Money owed to us, Payments made, Borrowings, Budgets, Cash book) stay in the sidebar; the heavier accounting and funding tools (Ledger, Tally, GST, Vendor ledgers, Spend, Recurring, Secret cash book, Treasury, Capital) now live together on a new “Accounts & Books” page. Nothing was removed — just organised.',
      'No database change needed for this one.',
    ],
  },
  {
    version: 'v15.34',
    date: '27 Jul 2026',
    highlights: [
      'Sign-in takes you straight to your home screen. Two-factor is still required, but once you’ve set it up you’ll never be sent to the security page again — and if you haven’t, you now get a gentle reminder plus an email every couple of days, instead of a wall on every visit.',
      'Forgot your password? There’s now a “Forgot your password?” link on sign-in that emails you a secure, one-time reset link.',
      'Admins can issue a temporary password for any user (Team & Admin → Users → ⋯ → Generate temporary password). It’s shown once to share, and the user must change it at next sign-in.',
      'A “Take a tour” button now sits in the top bar on every screen — a quick guided walkthrough of the whole CRM, for anyone, any time.',
      'A friendly prompt now offers to turn on notifications on phone and desktop, so approvals, overdue payments and messages can reach you even when the CRM isn’t open.',
      'Layout hardening for phones, tablets and smaller laptops so long text, images and wide tables no longer push the page sideways.',
      'No database change needed for this one.',
    ],
  },
  {
    version: 'v15.33',
    date: '27 Jul 2026',
    highlights: [
      'The Daily Briefing works again. Its AI summary was wired only to the old Google account (now blocked), so it silently never appeared — it now runs on your live AI provider (OpenRouter), the same one the rest of the app uses.',
      'And it never comes up blank: if AI is unreachable, the briefing falls back to a clear, rule-based summary built from the same risk signals, so you always get a headline, the key risks, and three actions for the day.',
      'No database change needed for this one.',
    ],
  },
  {
    version: 'v15.32',
    date: '27 Jul 2026',
    highlights: [
      'The bank IFSC that prints on invoices and receipts is corrected to a valid 11-character code, so a transfer to it is no longer rejected. If you set company details in-app, update the IFSC there too — the saved value wins over the default.',
      'AI now reads as “switched on” everywhere it is used. The system’s internal “is AI available?” check was still looking for the old Google key; it now recognises your OpenRouter keys, so features stop showing “connect this” when AI is in fact working.',
      'Admin → AI health now shows your live provider, model, how many keys are in rotation, and whether a fallback provider is set — so you can confirm all your keys loaded without opening Vercel. (Keys are counted, never shown.)',
      'No database change needed for this one.',
    ],
  },
  {
    version: 'v15.31',
    date: '25 Jul 2026',
    highlights: [
      'The big OAuth apps are now connectable — Slack, Google (Sheets/Drive/Calendar/Gmail), HubSpot, Zoho CRM, Salesforce, Microsoft (Teams/Outlook/OneDrive), Zoom, Dropbox, Xero and QuickBooks. Add your own app’s client id/secret, register the callback URL we show you, and click Connect to authorise — the standard secure sign-in flow.',
      'Access and refresh tokens are stored encrypted, and the sign-in is protected against tampering with a signed, expiring state, so only a genuine round-trip completes.',
      'This completes phase 2’s framework: messaging (Slack/Discord/Telegram), portal leads, Razorpay payments and now OAuth apps all share one install → configure → connect experience. Turning each remaining app’s data sync fully on continues from here.',
      'No database change needed for this one.',
    ],
  },
  {
    version: 'v15.30',
    date: '25 Jul 2026',
    highlights: [
      'Razorpay is now live for auto-reconciliation. Install it from the App Exchange, add your API keys (verified against Razorpay on the spot), and paste the webhook URL into your Razorpay dashboard.',
      'When a payment is captured, the CRM matches it to the right booking milestone automatically — using the milestone or booking id you set in the payment notes — and marks it paid. Anything it can’t match with confidence is logged and finance is notified, never guessed.',
      'Every webhook is signature-verified with your Razorpay secret, and your keys are encrypted at rest, so only genuine Razorpay events are accepted.',
      'No database change needed for this one.',
    ],
  },
  {
    version: 'v15.29',
    date: '25 Jul 2026',
    highlights: [
      'Property-portal leads now flow straight in. 99acres, MagicBricks, Housing.com, NoBroker, Square Yards, Sulekha, CommonFloor and PropTiger are live: install one from the App Exchange, hit Configure, generate its inbound URL, and paste that into the portal — enquiries then land in the CRM automatically.',
      'It just works whatever the portal calls its fields — name, mobile, query, budget and project are recognised across formats, duplicates are merged onto the original lead (no commission fights), and your lead automations, Slack/WhatsApp alerts and webhooks all fire as usual.',
      'Each portal gets its own secret URL you can rotate any time, so you can cut off one source without touching the others.',
      'No database change needed for this one.',
    ],
  },
  {
    version: 'v15.28',
    date: '25 Jul 2026',
    highlights: [
      'Connectors now actually work — this is phase 2 of the platform. Slack, Discord and Telegram are live end-to-end: install one from the App Exchange, hit Configure, paste your webhook/bot details, choose which events to announce, and Test it — then the CRM posts there automatically when a lead arrives, a deal is won, or a task is created.',
      'Credentials are kept safe. Any secret you enter (a webhook URL, a bot token) is encrypted at rest and never shown back to you in full — only a masked placeholder.',
      'Under the hood this is a reusable connector runtime: the same install → configure → test → auto-send flow will light up more connectors (payments, sheets, portals) in the coming releases.',
      'No database change needed for this one.',
    ],
  },
  {
    version: 'v15.27',
    date: '25 Jul 2026',
    highlights: [
      'New App Packages (Admin → App Packages) — install ready-made bundles that set up several things at once: custom fields, automations, saved views and connectors, all in one click. Starter packs include an NRI Sales Kit, Collections Booster, Channel Partner Pack, Site Safety Pack and Compliance Starter.',
      'Now you can extend the CRM yourself, no code needed. Author your own package, export it (and your current fields + automations) as a shareable JSON file, and import one to reproduce a setup on another workspace — the foundation of building and sharing your own apps on Ameya.',
      'Everything is reversible: removing a package cleans up what it added, and any custom-field values you already captured are kept. Imported automations always arrive switched off so you can review them first.',
      'This version needs a small database change — run MIGRATION_v15.27_all.sql in Neon before deploying (it adds the app-package installs table).',
    ],
  },
  {
    version: 'v15.26',
    date: '25 Jul 2026',
    highlights: [
      'New Developers area (Admin → Developers) — an interactive API playground where you can browse every REST endpoint, fill in parameters, and run a real request with your token, seeing the live response and a ready-to-copy curl command.',
      'The API is now self-documenting: a machine-readable OpenAPI 3.1 spec is published at /api/v1/openapi, so tools like Postman, Insomnia and code generators can import the whole API automatically.',
      'A safe sandbox endpoint (GET /api/v1/ping) lets partners and integrators test their token, auth and connectivity without touching any data — the recommended first call when building on Ameya.',
      'No database change needed for this one.',
    ],
  },
  {
    version: 'v15.25',
    date: '25 Jul 2026',
    highlights: [
      'New App Exchange (Admin → App Exchange) — a browsable directory of 140+ connectors across 13 categories: chat (Slack, Teams, WhatsApp), payments (Razorpay, Stripe, Tally), CRM, marketing, storage, real-estate portals, telephony and more. Search, filter by category, and install with one click.',
      'A couple of dozen are live end-to-end today (WhatsApp, Gmail, Google Sheets/Drive/Calendar, Razorpay, Stripe, Twilio, Exotel, Zapier, Make, webhooks, REST API and more); the rest are listed and installable, and the framework lights up their wiring over time.',
      'This is the foundation of the new platform: installs are tracked per workspace and can be enabled, disabled or removed at any time. Deeper two-way integrations, the developer sandbox and installable app packages are coming in the next releases.',
      'This version needs a small database change — run MIGRATION_v15.25_all.sql in Neon before deploying (it adds the connector-installs table).',
    ],
  },
  {
    version: 'v15.24',
    date: '24 Jul 2026',
    highlights: [
      'Under-the-hood: added an automated test suite covering the newest features — channel-partner commission maths, at-rest chat/PII encryption, GST filing JSON, webhooks, the consent trail, personal automations and email threading. Nothing changes on screen; this just guards these features against future regressions so upgrades stay safe.',
      'The full suite now runs on every build (nearly 400 checks), so a change that would break one of these is caught before it ships.',
    ],
  },
  {
    version: 'v15.23',
    date: '24 Jul 2026',
    highlights: [
      'New consent register (Admin → Privacy & DPDP) — look someone up by email or phone and see, and change, exactly what they’ve agreed to: marketing, WhatsApp, calls and data processing. Every change is kept as an append-only trail, so a withdrawal never erases the earlier record — a defensible history for DPDPA.',
      'Web forms and other systems can record consent automatically through the public API (POST /api/v1/consent), and marketing consent stays in step with the lead’s own flag.',
      'Data retention is now enforced, not just declared. Once you set a retention period, a nightly sweep quietly removes dead leads (lost, long-inactive, never booked) past that period — won deals, active buyers and financial records are never touched. Daily backups now also roll off automatically after 180 days.',
      'This version needs a small database change — run MIGRATION_v15.23_all.sql in Neon before deploying (it adds the consent table).',
    ],
  },
  {
    version: 'v15.22',
    date: '24 Jul 2026',
    highlights: [
      'There’s now an iOS app path. Alongside the existing Android build, a new Capacitor project wraps the CRM for the App Store and TestFlight — so iPhone and iPad users can install it as a real app, not just a home-screen shortcut.',
      'Both wrappers load the live app, so there’s nothing extra to maintain — the same sign-in, 2FA and push work, and the app updates the moment you deploy. Build steps are in MOBILE_APP.md (Android in android/, iOS in mobile/).',
      'iPhone “open a CRM link in the app” (universal links) is pre-wired — drop in your Apple Team ID and it works.',
    ],
  },
  {
    version: 'v15.21',
    date: '24 Jul 2026',
    highlights: [
      'New Webhooks (Admin → Webhooks) push CRM activity to Zapier, Make or any system in real time. Choose the events you care about — a lead created, a lead changing stage, a task created or finished — and we POST a signed JSON payload to your URL the instant it happens.',
      'Every delivery is signed (HMAC-SHA256 in an x-ameya-signature header) so your receiver can be sure it came from us, and a test button lets you confirm your endpoint in one click. Dead endpoints disable themselves automatically so they never slow the CRM.',
      'Zapier and Make can subscribe on their own through the public API (POST /api/v1/webhooks with your API token), which — together with the existing REST endpoints for leads and units — makes a proper two-way connector.',
      'This version needs a small database change — run MIGRATION_v15.21_all.sql in Neon before deploying (it adds the Webhook table).',
    ],
  },
  {
    version: 'v15.20',
    date: '24 Jul 2026',
    highlights: [
      'New GST Filing page (under Finance) turns your invoices into filing-ready JSON — no re-typing. Download a month’s GSTR-1 (B2B, B2C and HSN summary), or an individual invoice’s e-invoice (IRN) and e-way-bill JSON, then upload it to the GST / IRP / e-way-bill portal, or import into Tally.',
      'It handles the tax split for you — CGST/SGST for a sale within your state, IGST for an inter-state sale, worked out from the buyer’s GSTIN.',
      'Everything is generated inside the CRM and downloaded — nothing is transmitted to any portal from here, so the tool stays simple and safe. As always, have your CA review before filing.',
    ],
  },
  {
    version: 'v15.19',
    date: '24 Jul 2026',
    highlights: [
      'New Shared Inbox — every email and WhatsApp conversation in one place. The whole team can see what came in, open the linked lead, customer or vendor, and reply without switching to Gmail or a phone. Find it in the sidebar under Messages.',
      'Replies are two-way and stay on the record. Answer an email or a WhatsApp message right from the inbox; your reply is sent and saved into the same conversation, so the next person sees the full history — and lead replies are logged on the lead’s timeline automatically.',
      'This version needs a small database change — run MIGRATION_v15.19_all.sql in Neon before deploying (it adds one column so WhatsApp replies can be stored).',
    ],
  },
  {
    version: 'v15.18',
    date: '24 Jul 2026',
    highlights: [
      'Bank account numbers and PAN details are now encrypted at rest. Vendor bank account numbers and PAN, and channel-partner PAN, are stored scrambled (AES-256-GCM) in the database — so a database or backup leak exposes gibberish, not usable fraud material. They’re unscrambled automatically wherever you’re allowed to see them, so nothing looks different day-to-day.',
      'This needed no data migration and no re-typing. Existing records stay readable and quietly become encrypted the next time they’re saved.',
      'Semi-public identifiers (GSTIN, IFSC) stay as-is so they remain searchable, and the company’s own bank records already keep only the last four digits.',
    ],
  },
  {
    version: 'v15.17',
    date: '24 Jul 2026',
    highlights: [
      'My Automations now actually run for you. The schedule automations you switch on — daily chase lists, weekly reviews, month-end checklists — quietly raise a dated task on your own list each day, using the timing and priority you set. Nobody else’s account is touched.',
      'Everyone can now open My Automations and tailor their own. It no longer needs dashboard permission — it’s personal to your account, so any signed-in person can switch rules on and tune them.',
      'Your automation-raised tasks never pile up. Each is created at most once a day, so a retry or a re-run of the nightly job can’t leave you with duplicates.',
    ],
  },
  {
    version: 'v15.16',
    date: '24 Jul 2026',
    highlights: [
      'Team chat messages are now encrypted at rest. Message text is stored scrambled (AES-256-GCM) in the database, so a database or backup leak exposes gibberish, not your conversations. It’s decrypted only for the people in the chat — search, mentions and read-receipts all keep working. (Older messages stay readable and become encrypted as new ones are sent.)',
      'Chat now accepts any file — images, videos, PDFs, spreadsheets, zips, anything (up to 200 MB). Images show inline, videos and audio play right in the chat, and everything else is a one-tap download. You no longer need document permissions to share a file in a conversation.',
      'Message previews are no longer copied into notifications, so nothing sensitive leaks out of the encrypted chat.',
    ],
  },
  {
    version: 'v15.15',
    date: '24 Jul 2026',
    highlights: [
      'Sign-in now takes you straight to your Home screen. If two-factor still needs setting up, it’s a friendly reminder on Home — not a forced detour through the security page.',
      'Home now shows your role at a glance, so you always know what you can do.',
      'New: ask AI to make a Tally entry for you. On the Ameya Tally screen, press “Ask AI”, type something like “Paid ₹50,000 to ABC Cement by bank”, and it drafts the balanced double-entry voucher — you review it and press Post. It can even create a missing ledger on the spot. Nothing is ever written to the books without your confirmation, and every posted entry is audited exactly like a manual one.',
    ],
  },
  {
    version: 'v15.14',
    date: '24 Jul 2026',
    highlights: [
      'Closing the one gap the market comparison flagged (Communications). The telephony, WhatsApp-Business, portal-lead and two-way-email engines were already built but idle — the Integrations screen (Team & Admin → Integrations) now hands you the exact webhook URL to paste and the plain steps to switch each one on.',
      'Two-way email now appears as its own integration with a live count of messages threaded onto leads, buyers and vendors — so you can see replies are being captured, not just mail going out.',
      'WhatsApp is shown as a proper two-way Business channel (Meta Cloud API): templates and broadcasts out, replies into a shared inbox — with the callback URL and verify-token steps spelled out. Free Meta tier, so it stays clear of the no-Google-billing rule.',
      'Each channel shows Working / Ready-but-unused / Not-set-up honestly, so nothing rots silently.',
    ],
  },
  {
    version: 'v15.13',
    date: '24 Jul 2026',
    highlights: [
      'New File Tools screen (Documents → File Tools): merge PDFs, extract PDF pages, turn images into a PDF, and convert spreadsheets between Excel, CSV, JSON and Markdown — all on your own device, with no files uploaded and no AI credits used.',
      'Channel partners can now be paid three ways, not just a percentage: choose “% of sale”, “months of rent” (for commercial leases) or a flat fee when onboarding a partner, and the right amount shows everywhere.',
      'Overdue reminders and emails now stop the moment work is closed — a task that’s cancelled (not only completed) no longer keeps chasing you.',
      'Today’s Priorities is more complete — it now also lists today’s calendar events and any open work requests assigned to you.',
      'Clearer errors and fixes: profile-photo uploads work for everyone (not just document managers), AI-import errors now say exactly what to fix (e.g. an expired AI key), the map explains whether it’s the device, the network or blocked imagery, and a very rough GPS fix now warns instead of silently recording a wrong distance.',
    ],
  },
  {
    version: 'v15.12',
    date: '23 Jul 2026',
    highlights: [
      'Automations are back in the menu — the company-wide automation engine (Team & Admin → Automations) was never removed, just unlinked; it now has a menu entry again, alongside its templates, AI builder and run log.',
      'A brand-new My Automations screen (My Day → My Automations) with over 100 ready-made automations across every department — Sales, Marketing, Billing & Collections, Accounts, Legal, Site, Customer Care, HR, Procurement, Architecture, Management and more.',
      'Every automation is customisable per person — switch on just the ones you want working for you, tweak the timing (due-in days) and priority, or flip a whole department on or off. Your choices are personal and never change anyone else’s.',
    ],
  },
  {
    version: 'v15.11',
    date: '23 Jul 2026',
    highlights: [
      'Marketing Library now takes uploads. Upload individual files, or a whole folder — the AI reads each file and sorts it into a category (Renders & Images, Floor Plans, Brochures, Legal, Financial, Comparisons, Presentations). Everything lands grouped and ready to view or download.',
      'Add a Google Drive (or any web) link to view a document in place — it shows up in the library with an “Open in Drive” button, sorted into a category like everything else.',
      'The bundled Ameya collaterals stay pinned under “Featured”; uploaded and linked items appear below, grouped by category, with delete for marketing managers.',
    ],
  },
  {
    version: 'v15.10',
    date: '23 Jul 2026',
    highlights: [
      'Watermark refined — it’s now just the transparent gold Ameya medallion (no “Ameya” wordmark, no navy background), the same mark used on the documents, at a slightly higher opacity behind every screen.',
      'Home page is now a morning cockpit — six live KPI tiles (new leads today, tasks due, approvals pending, follow-ups this week, collections due this week, who’s on site now), plus the Quick actions grid, a wider Today’s agenda, a Next 7 days card and Jump-to shortcuts. Each tile links straight to the screen behind it.',
    ],
  },
  {
    version: 'v15.9',
    date: '23 Jul 2026',
    highlights: [
      'The Ameya emblem watermark is now clearly visible — the navy logo sits softly behind every screen (it was there before but far too faint).',
      'Top bar shortcuts now carry a Tally button and clearer descriptions — Messages, Assistant, Ameya Tally and Explore features each show a label on wide screens and a full description on hover.',
      'A bigger, more useful Home page — a grid of Quick actions (Today, Tally, Assistant, Scan, Messages, Dashboard, Reminders, Calendar), a wider Today’s agenda, and a “Jump to” panel, so home is a launchpad rather than just a greeting.',
    ],
  },
  {
    version: 'v15.8',
    date: '23 Jul 2026',
    highlights: [
      'Marketing Library (Marketing → Marketing Library) — your key collaterals are now bundled into the CRM and always a click away: the Basaveshwar front and commercial renders, the interactive 3D building model, the Ameya-vs-national-developers comparison, the roadmap tracker, the latest website-audit PDF and the Ameya emblem. View or download each; the 3D model and PDF open in a new tab.',
    ],
  },
  {
    version: 'v15.7',
    date: '23 Jul 2026',
    highlights: [
      'Schedule III statement in Ameya Tally (press 3) — the balance sheet recast into the Companies Act 2013 Schedule III (Division I) format your CA and bank expect: Equity & Liabilities (shareholders’ funds, non-current and current liabilities) against Assets (non-current and current), with the period’s profit taken to Reserves & surplus. Exports to Excel. This is the last of the offline “latest Tally” features.',
    ],
  },
  {
    version: 'v15.6',
    date: '23 Jul 2026',
    highlights: [
      'Personalised tax invoices in Ameya Tally — open the Day Book and any Sales or Purchase entry now has an “invoice” button that prints a branded A4 tax invoice (navy & gold, Ameya emblem watermark) with the party, HSN/SAC per line, CGST/SGST breakup, invoice total and the amount in words, plus your company details and GSTIN.',
      'HSN/SAC-wise summary added to GST Returns — the GST screen now includes the HSN-wise table of outward supplies (GSTR-1 Table 12): HSN, rate, quantity, taxable value and tax.',
    ],
  },
  {
    version: 'v15.5',
    date: '23 Jul 2026',
    highlights: [
      'Ameya Tally is now desktop-only — open it on a phone and you get a friendly note to switch to a computer, since it’s keyboard-driven. The rest of the CRM still works on mobile.',
      'A built-in Keyboard shortcuts screen (press ?) lists every F-key and letter, with a Mac / Windows toggle that shows the right way to press them (e.g. fn + F5 on a Mac laptop).',
      'Personal Tally settings — each user can set their own company name in the title bar, the default voucher type, the default period the app opens on, and their keyboard style. It’s per-user and never changes the books.',
    ],
  },
  {
    version: 'v15.4',
    date: '23 Jul 2026',
    highlights: [
      'Drag-and-drop menu — press “Customise this menu” and now you can drag whole sections into the order you want (put Money or Finance right at the top), and drag individual items within a section, using the grip handle. Pin and hide still work, keyboard dragging is supported, and it’s saved per person. Reset puts everything back.',
    ],
  },
  {
    version: 'v15.3',
    date: '23 Jul 2026',
    highlights: [
      'Ameya emblem watermark — the real Ameya Heights emblem now sits as a faint, fixed brand mark behind every screen in the app. It’s very low opacity and non-interactive, so it reads as a subtle backdrop, not clutter, and adapts to light and dark themes.',
    ],
  },
  {
    version: 'v15.2',
    date: '23 Jul 2026',
    highlights: [
      'Scan (QR / Barcode) under Build & Site — point your phone or laptop camera at a unit QR or material barcode to read it instantly. Matching unit codes and parking slots link straight to their screens; a scanned web link or CRM path opens in a tap. You can also type a code by hand if the camera isn’t available.',
    ],
  },
  {
    version: 'v15.1',
    date: '23 Jul 2026',
    highlights: [
      'Scan a GRN (Procurement) — photograph or upload a delivery challan and the AI reads the vendor, material, PO reference and ordered/received/billed quantities straight into a goods-receipt, ready to check and save. No more typing challans by hand; the three-way match then works as before.',
    ],
  },
  {
    version: 'v15.0',
    date: '23 Jul 2026',
    highlights: [
      'Litigation & Renewals (Land, Lease & Legal) — a proper court-matter docket. Every matter now keeps its full hearing history on a timeline: date, purpose, outcome and the next date the court gave, added in a click. The matter’s next-hearing date rolls forward automatically.',
      'EC / Khata renewal alerts — set a “renew by” date on any Encumbrance Certificate or Khata and the CRM flags it amber 60 days out and red once overdue, so land documents never quietly lapse.',
    ],
  },
  {
    version: 'v14.99',
    date: '23 Jul 2026',
    highlights: [
      'Parking Matrix (Inventory & Bookings) — a visual grid of every parking slot by level. Add slots one at a time or generate a whole basement at once (B1-001 … B1-120), then click any slot to assign it to a unit, block it, or free it. Colour-coded by status with live counts by type, and it works per project.',
    ],
  },
  {
    version: 'v14.98',
    date: '23 Jul 2026',
    highlights: [
      'Ameya Tally phase 11 — Ratio Analysis (press A). One screen of the numbers your CA and bank ask for: working capital, current & quick ratios, debt-equity, net profit %, return on capital employed, debtors, creditors and closing stock — all for the selected period, with the basis shown under each and an Excel export.',
      'Ameya Tally is now feature-complete for in-house books: masters, all six voucher types with keyboard shortcuts, item invoices with auto-GST, cost centres & job costing, bank reconciliation, voucher editing, GST returns, cash/funds flow and ratios — plus Trial Balance, P&L, Balance Sheet, Day Book, outstanding ageing and branded PDF/Excel exports throughout. The connected tier (GST e-filing JSON, e-invoice/e-way-bill, live bank feeds, Tally sync) is ready to switch on once credentials are provided.',
    ],
  },
  {
    version: 'v14.97',
    date: '23 Jul 2026',
    highlights: [
      'Ameya Tally phase 10 — Cash Flow & Funds Flow (press F). Cash Flow shows opening cash & bank, money received and paid grouped by ledger, and the closing balance for the selected period. Funds Flow lays out the sources of funds against how they were applied, including the period’s profit as a source. Both export to Excel.',
    ],
  },
  {
    version: 'v14.96',
    date: '23 Jul 2026',
    highlights: [
      'Ameya Tally phase 9 — GST Returns summary. A new report (press G) shows GSTR-1 outward supplies grouped by tax rate, your input tax credit on purchases, and a GSTR-3B net-payable working (output tax less ITC), all for the selected period and exportable to Excel. Tax is split CGST/SGST for intra-state supply; filing-ready JSON and inter-state IGST come with the connected GST tier. Have your CA review before filing.',
    ],
  },
  {
    version: 'v14.95',
    date: '23 Jul 2026',
    highlights: [
      'Ameya Tally phase 8 — Edit vouchers. The Day Book now has an “edit” button on every entry. Accounting vouchers (Contra, Payment, Receipt, Journal) open in the full editor so you can fix the date, narration, cost centre or any line and re-save (it still has to balance). Item invoices open a safe header editor for the date, narration and cost centre — their stock and amounts stay intact.',
    ],
  },
  {
    version: 'v14.94',
    date: '23 Jul 2026',
    highlights: [
      'Ameya Tally phase 7 — Bank Reconciliation. Pick any bank ledger (press R), then tick off each entry with the date it cleared your bank statement. Ameya Tally shows your balance as per books, the amounts not yet cleared, and the balance as per bank — which should match your statement once everything on it is dated. Cleared rows turn green.',
    ],
  },
  {
    version: 'v14.93',
    date: '23 Jul 2026',
    highlights: [
      'Ameya Tally phase 6 — Cost Centres & Job Costing. Create a cost centre for each project or site (Tower A, Clubhouse, Phase 2), tag it on any voucher or item invoice, and open the new Job Costing report to see income, expense and profit per centre for the chosen period. Manage centres under Masters (press C); run the report with J. Untagged entries roll up under “Unallocated”, and the report exports to Excel.',
    ],
  },
  {
    version: 'v14.92',
    date: '23 Jul 2026',
    highlights: [
      'Ameya Tally phase 5 — period filter: a bar at the top lets you view every report for This Month, This Quarter, This FY (Apr–Mar), All time, or a custom date range. Trial Balance and Balance Sheet show the position as-at the To date; Profit & Loss and Day Book cover the chosen period — exactly like Tally.',
      'The period flows into the PDF/Excel exports too, so a statement you hand your CA is stamped with the range it covers.',
      'No database change — deploy the zip as-is.',
    ],
  },
  {
    version: 'v14.91',
    date: '23 Jul 2026',
    highlights: [
      'Ameya Tally phase 4 — Outstanding & ledger drill-down: a new “Outstanding” report (press O) shows party-wise receivables and payables aged FIFO into 0–30 / 31–60 / 61–90 / 90+ buckets, so you can see exactly who owes what and how overdue it is.',
      'Click any ledger name (in Ledgers or the Trial Balance, or a party in Outstanding) to open its full statement — every debit and credit with a running balance and closing figure, like Tally’s ledger view.',
      'Both export to Excel. No database change — deploy the zip as-is.',
    ],
  },
  {
    version: 'v14.90',
    date: '23 Jul 2026',
    highlights: [
      'Ameya Tally phase 3 — shareable statements: every report (Trial Balance, Profit & Loss, Balance Sheet, Stock Summary) now has a “Print (PDF)” and an “Excel” button. The PDFs are branded in the Ameya navy + gold with the emblem watermark, ready to hand to your CA.',
      'No database change — deploy the zip as-is.',
    ],
  },
  {
    version: 'v14.89',
    date: '23 Jul 2026',
    highlights: [
      'Ameya Tally phase 2 — inventory & GST invoicing: create Stock Items (unit, HSN, GST rate, opening qty/rate), then raise Sales (F8) and Purchase (F9) item invoices. GST is auto-calculated per item and the CRM auto-posts the correct double-entry (a sale debits the party, credits Sales + Output GST; a purchase debits Purchase + Input GST, credits the party) and records the stock movement.',
      'New Stock Summary report — inward, outward, closing quantity and value per item, with a total stock value. Reach Stock Items with “I”, Stock Summary with “S”.',
      'Run MIGRATION_v14.89_all.sql in Neon before deploying (adds stock-item and inventory tables). If you skipped v14.88, run its migration first.',
    ],
  },
  {
    version: 'v14.88',
    date: '23 Jul 2026',
    highlights: [
      'Ameya Tally (phase 1): a self-contained, keyboard-driven accounting app inside the CRM — its own books, separate from everything else. Gateway screen, ledger masters, and double-entry voucher entry with function keys (F4 Contra, F5 Payment, F6 Receipt, F7 Journal, F8 Sales, F9 Purchase).',
      'Reports built in: Day Book, Trial Balance (with a live balanced/out-of-balance check), Profit & Loss, and Balance Sheet — all recomputed from your vouchers. Esc always returns to the Gateway.',
      'Find it under Money → Ameya Tally. Run MIGRATION_v14.88_all.sql in Neon before deploying (adds the Tally tables). More phases to come: Sales/Purchase item invoicing, inventory, GST, cost centres and printing.',
    ],
  },
  {
    version: 'v14.87',
    date: '23 Jul 2026',
    highlights: [
      'Channel Partner portal (Batch 4): each partner gets a private self-service link (Partners → Manage → Copy portal link). They register their own clients, and the CRM locks each client to them for 60 days — if a client is already registered by someone else, registration is refused, preventing poaching disputes.',
      'Partners see their own client list and commission payouts (earned / paid / pending) on the portal, cutting follow-up calls.',
      'Run MIGRATION_v14.87_all.sql in Neon before deploying (adds the partner portal token).',
    ],
  },
  {
    version: 'v14.86',
    date: '23 Jul 2026',
    highlights: [
      'Grounded AI assistant (Batch 7): the assistant has a new “library” toggle — switch it on and it answers from your own indexed documents (brochures, term sheets, letters) and cites which files it used, instead of answering generically.',
      'Index your files first from Documents → Ask (or the Ask Documents screen) so the assistant has something to search.',
    ],
  },
  {
    version: 'v14.85',
    date: '23 Jul 2026',
    highlights: [
      'Dashboard visualisations (Batch 6): a new “Visual overview” with a lead-pipeline bar chart, a lead-source pie, and a 6-month money-in-vs-out cash-flow graph — instant, at-a-glance comprehension in the navy + gold palette.',
      'Charts are colour-coded and read cleanly in light and dark mode.',
    ],
  },
  {
    version: 'v14.84',
    date: '23 Jul 2026',
    highlights: [
      'Home-loan tracking (Batch 3): a new “Home Loans” screen under Inventory & Bookings tracks each buyer’s loan — bank, amount, sanction, disbursement, and one-tap NOC and tripartite-agreement toggles, with a status pipeline and pending-NOC count.',
      'Run MIGRATION_v14.84_all.sql in Neon before deploying this version (it adds the HomeLoan table).',
    ],
  },
  {
    version: 'v14.83',
    date: '23 Jul 2026',
    highlights: [
      'Post-sales & handover (Batch 2): buyers who report a snag now pick a type (structural, plumbing, electrical, finishing) — the CRM auto-routes it (structural/services → certifying engineer, finishing → site supervisor) and starts an SLA clock shown on both the portal and the internal snag list.',
      'New Letter of Possession PDF — generate a branded handover letter (with a handover checklist) from any buyer’s Manage panel.',
      'The buyer portal document vault is now organised into KYC, Legal, Financial and Handover sections, and you pick the category when sharing a document.',
      'Set the two routing people via settings keys snag.route.structural and snag.route.cosmetic (a user ID each).',
    ],
  },
  {
    version: 'v14.82',
    date: '23 Jul 2026',
    highlights: [
      'Chat now shows read receipts: your sent messages say “Sent”, then “Read ✓✓” once the other person opens the conversation. Always on — nobody can switch it off.',
      'Every payment can now be reclassified either way — “To cash” on bank/UPI payments and “To bank” on cash ones — so you have full control over where each entry lands.',
      'The Vendor Ledger is tidier: colour-coded mode pills (Cash / Bank / UPI) and a single wrapping row of pill actions per payment, so nothing gets clipped off the edge.',
    ],
  },
  {
    version: 'v14.81',
    date: '23 Jul 2026',
    highlights: [
      'Demand notices now compute the tax automatically: GST (default 5%, configurable) is added and TDS under Sec. 194-IA (1% when the consideration is ₹50 lakh or more) is shown as a deduction, with the net payable to the developer and a Form 26QB note — all on the letter.',
      'New RERA 70:30 escrow compliance statement: from Capital & Escrow, download a formal PDF showing receipts, the 70% required in the designated account, what’s deposited, the certified-progress withdrawable limit, and a clear COMPLIANT / under-funded / breach status.',
      'Both documents are now in the Ameya house colours — navy and gold.',
    ],
  },
  {
    version: 'v14.80',
    date: '23 Jul 2026',
    highlights: [
      'Private chat can now reach people by email: open a conversation and press “Notify by email” to send the other person a “you have a message waiting” note. Messages left unread for a few hours also trigger one automatic email, so nothing sits unseen.',
      'New joiners who haven’t signed in are now reliably emailed a “please log in” reminder (this used to depend on a schedule that wasn’t always running).',
      'A daily task email: each morning you get your open tasks with a one-tap “Mark done ✓” button per task — close things straight from your inbox, no sign-in needed.',
    ],
  },
  {
    version: 'v14.79',
    date: '23 Jul 2026',
    highlights: [
      'Redesigned payment receipt: the Ameya emblem at the top, a faint emblem watermark, and the house colours — deep navy and gold (no more yellow). The description of the payment now prints in its own clear panel right under the amount.',
      'When you record a payment, the “Description — what was this payment for?” box is clearer and prints straight onto the receipt.',
      'Payments can now be permanently deleted by an administrator (a deliberate two-tap “Delete forever”). Everyone else’s “Delete” still cancels-with-undo, so the audit trail is never lost by accident.',
    ],
  },
  {
    version: 'v14.78',
    date: '23 Jul 2026',
    highlights: [
      'The main menu is easier to read: items are a little bigger, and each one now shows its plain-language description right under the name — no more hovering to find out what a screen does.',
      'The menu is slightly wider to give those descriptions room. Collapse it to the icon rail any time if you want it slim.',
    ],
  },
  {
    version: 'v14.77',
    date: '23 Jul 2026',
    highlights: [
      'The assistant now reads documents: attach a PDF or a photo (a bill, a scan, a letter) and ask about it — “what’s the total?”, “when is this due?”, or just get a plain summary.',
      'Once it has answered, it offers to file the document for you — pick a folder (Legal, Bills, whatever you use) and it lands in Documents, summarised and backed up, without leaving the chat.',
      'Attachments up to 10MB; PDF and image formats. Larger or other files still go through the Documents screen as before.',
    ],
  },
  {
    version: 'v14.76',
    date: '23 Jul 2026',
    highlights: [
      'The AI assistant is now everywhere: a small button in the bottom-right corner of every screen opens it, so you can ask, draft or summarise without leaving the page you’re on.',
      'Feedback has moved from the floating corner button into the menu — find “Send Feedback” under Team & Admin, with more room to write.',
      'On phones, the quick-actions “+” button now sits neatly above the assistant instead of overlapping it.',
    ],
  },
  {
    version: 'v14.75',
    date: '23 Jul 2026',
    highlights: [
      'New Home screen (and where you land after signing in): a warm “Good morning, <name>” with the live date and time, your local weather — temperature, conditions, precipitation, UV index and your city — and today’s agenda in one place.',
      'Weather uses your device location and a free, keyless service — allow location access the first time to see it.',
    ],
  },
  {
    version: 'v14.74',
    date: '23 Jul 2026',
    highlights: [
      'Fixed: “To cash” now works end-to-end — the Cash Book no longer hides payments that aren’t tagged to a project, so a reclassified payment shows up there.',
      'Fixed: folding a menu section now always works, even when you’re on a page inside it (it used to spring back open).',
      'After signing in you now land straight on your home screen instead of being sent to the password/security page.',
    ],
  },
  {
    version: 'v14.73',
    date: '23 Jul 2026',
    highlights: [
      'From a vendor’s ledger you can now, on each payment: print a payment slip (PDF), delete it (with undo), or “To cash” to reclassify a bank payment as cash so it lands in the Cash Book.',
      'Payments Made has Cash / Bank / UPI filter chips, so you can see just your cash payments (or just bank) at a glance.',
      'Real Excel (.xlsx) export added — Payments Made, a payee’s passbook, and the Secret Cash Book each export a proper spreadsheet, not just CSV.',
    ],
  },
  {
    version: 'v14.72',
    date: '23 Jul 2026',
    highlights: [
      'New Secret Cash Book (Money → Secret Cash Book): a private cash book only you and people you nominate can open. Every time it’s opened it asks for a one-time code sent to your email and WhatsApp, and it re-locks itself after a while.',
      'Its entries are stored in a separate, walled-off table — they never appear in the normal books, reports or exports. Cash in / cash out / running balance, with add, delete and CSV export.',
      'As the owner you can nominate exactly who else may open it, from inside the cash book.',
    ],
  },
  {
    version: 'v14.71',
    date: '23 Jul 2026',
    highlights: [
      'Combining duplicate payees (e.g. all the “Arun”/construction rows into one) now updates Payments Made instantly, not just Vendor Ledgers — so a merged payee shows here as a single total straight away.',
      'Payments Made now has a one-line pointer to the “Tidy up payees” tool, so it’s obvious where to combine the same payee that’s recorded under different names.',
    ],
  },
  {
    version: 'v14.70',
    date: '23 Jul 2026',
    highlights: [
      'Less clutter on phones: the little stat boxes at the top of a screen are now one clean swipeable strip of comfortably-sized tiles, instead of three or five squeezed side by side.',
      'The breadcrumb trail is hidden on phones (the page title already tells you where you are), and the top bar drops the Messages and Assistant icons on mobile — they live in the menu — so the header breathes.',
      'Long page descriptions are trimmed to two lines on a phone so the actual content starts higher up.',
    ],
  },
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
