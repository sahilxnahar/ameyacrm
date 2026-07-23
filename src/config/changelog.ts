/**
 * The current app version and a short, human "what changed" list per release.
 * The What's-new panel shows the top entry once, when the version a person last
 * saw (stored on their device) is older than this one. Keep each line plain and
 * benefit-first — this is read by everyone, not just the person who built it.
 */
export const APP_VERSION = 'v15.0';

export interface Release {
  version: string;
  date: string;
  highlights: string[];
}

export const CHANGELOG: Release[] = [
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
