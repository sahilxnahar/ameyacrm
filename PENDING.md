# Ameya Heights CRM — what's pending
_Ask me "what do I have pending?" any time and I'll read this back._
_Last updated: 21 July 2026 · current build v10.8_

---

## 1. Waiting on you — do these first

- **Replace the Gemini API key — nothing AI works until you do.** Google has blocked the project behind the current key (403 PERMISSION_DENIED). Go to aistudio.google.com/apikey, delete the old key, create a new one in a **new** project, update `GEMINI_API_KEY` in Vercel, redeploy, then check Admin → AI Health.

- **Run Admin → AI Health → Index everything** once after deploying, so the AI can see leads, bookings, invoices, tasks and payments — not just files.
- **See ROADMAP.md** for what to build next, in order.

- **Appoint the finance team** — Admin → Finance Access. Until you tick people, only Super Admins can see expenses and payments.

- **Run the AI self-test** — Admin → AI Health → "Run the check". Four live probes against Google. Tells you whether the AI actually works, not just whether a key is present.
- **Backfill the UTRs** — Payments Made → "Missing UTR only". Paste each bank SMS and let the AI fill it in.

| # | What | Why it matters |
|---|---|---|
| 1 | **Deploy v10.8** — run `MIGRATION_v10.8_all.sql` in Neon, sync `ameya-heights-crm-v10.8.zip`, Create Deployment | Expense import, UTR tracking, receipts and AI health are all waiting |
| 2 | **Retest the menu customiser** — sidebar → Customise this menu | Controls were clipped off the edge; now on their own row |
| 3 | **Retest Billing → Import bill (AI)** with your PDF | Was refusing valid PDFs; now infers the type and reports the real reason |
| 4 | **Import your data** — Admin → Import Data | The system is still essentially empty. Units, then bookings, then payment schedules, then leads |
| 5 | **Fix the IFSC** — Admin → Company Details | `KKBK00008556` is 12 characters; an IFSC is 11. It prints on every invoice |
| 6 | **Create the Salavakkam project** | The project switcher only has Four94 to switch to |
| 7 | **Restrict the Drive folder** if not done | *Ameya CRM Details* was "Anyone with the link" |
| 8 | **Second deployer** — RUNBOOK.md §8 | You are still the only person who can deploy or recover this |

---

## 2. Agreed and queued to build

| What | Notes |
|---|---|
| **Cash book / vouchers** | Cash received, cash paid, material received. Your request. Next up |
| **Letterhead on documents** | A4 letterhead is staged at `/brand/letterhead/`; not yet applied to invoice and letter PDFs |
| **Workflow canvas** | Drag nodes, draw conditions, simulate against real history before going live |
| **Predictive lead scoring** | Trained on your own won/lost record, not a prompt |
| **Revenue intelligence** | Pipeline waterfall, cohorts, cash-flow forecast, monthly board pack |
| **Territories & SLA** | Routing by geography and typology, escalation trees |
| **Collaboration** | @mentions, comment threads, notification digests |

---

## 3. Buildable right now — nothing new to buy

Everything here runs on what you already have: your Gemini key, Google Workspace,
the Apps Script connector, Vercel, Neon, and your brand kit.

**Money and documents**
- Cash book and vouchers · buyer ledger statement PDF · payment receipts with letterhead
- GST summary export for your accountant · per-project cost-sheet templates
- Cancellation and refund workflow · internal commission tracking (slabs already exist)
- Quotation builder with versions and approval

**Sales**
- Drag-and-drop pipeline board · bulk actions on leads · auto-assignment rules
- Site-visit scheduler with confirmations and post-visit feedback
- Lead source ROI — cost per lead through to cost per booking
- Lost-reason analytics · sales leaderboard and targets

**Buyers**
- Handover checklist and digital possession certificate
- NPS capture after milestones · referral programme tracking
- Public inventory link for brokers · unit comparison side by side
- Construction timeline tracker

**AI — your existing Gemini key covers all of this**
- Meeting notes into action items with owners
- Weekly performance review per rep
- Auto-tagging and natural-language search ("NRI leads over 2 Cr")
- Risk alerts: stalled leads, at-risk collections, units held too long

**Google — free through the connector you already run**
- Any report exported to Sheets on a schedule
- Announcements with read-acknowledgement
- SOP and training library with completion tracking

**Platform**
- Audit log search and export · backup restore drill
- Offline-first capture for site teams · price list versioning

---

## 4. Blocked on a paid account — not buildable yet

| What | Needs |
|---|---|
| WhatsApp two-way inbox and broadcasts | Meta Cloud API (free tier exists, account required) |
| Telephony and call recording | Exotel or Knowlarity, per-minute. **The AI half is already built and idle** |
| Online card/UPI payments | Razorpay — you declined; manual UTR stays |
| Portal API feeds | Paid listing accounts on 99acres / MagicBricks |

---

## 5. Known problems

- **A stale extracted copy of the project sits in `CRM/ameya-heights-crm/`.** It is many versions old. If you ever sync *that* folder to GitHub you will deploy an ancient build. Always extract the newest zip fresh, or delete that folder.


- **IFSC is invalid** — 12 characters, must be 11
- **GSTIN corrected** to `29ACOFA6794K1ZG` — validates cleanly now
- **Connector header comment** still says v9.1 and "four triggers"; cosmetic, code is current
- **Single maintainer** — the largest operational risk in the whole system
