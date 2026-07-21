# Ameya Heights CRM — what's pending
_Ask me "what do I have pending?" any time and I'll read this back._
_Last updated: 21 July 2026 · current build v11.8_

---

## 1. Waiting on you — do these first

- **Rotate the three connector keys — they were committed to the repository.** `GAS_SECRET`, `CRON_SECRET` and `INGEST_SECRET` were written into `docs/google-connector/Code.gs`, which is in git. If that repo is public they are public. Generate three new values, update them in Vercel, and paste them into the Apps Script editor (the committed file now holds placeholders only).

- **Fix the IFSC — it is printing on invoices going to buyers.** `KKBK00008556` is 12 characters; every Indian IFSC is 11. A transfer sent to it will be rejected. Admin → Company Details now shows this in red at the top. While you are there, add the company phone number.


- **Set the pooled connection string, or the CRM stays slow.** In Neon, copy the connection string whose host contains `-pooler`, set it as `DATABASE_URL` in Vercel, and keep the direct one as `DATABASE_URL_UNPOOLED`. Then open Admin → Performance: it measures the round trip and tells you whether it worked.

- **Create a Meta app for WhatsApp, or no message will ever send.** Admin → Connected Accounts → WhatsApp → "Set it up" lists the five steps. Until `META_APP_ID` and `META_APP_SECRET` are in Vercel there is no Connect button, and until a template is approved by Meta the CRM cannot message anyone first.

- **Replace the Gemini API key — nothing AI works until you do.** Google has blocked the project behind the current key (403 PERMISSION_DENIED). Go to aistudio.google.com/apikey, delete the old key, create a new one in a **new** project, update `GEMINI_API_KEY` in Vercel, redeploy, then check Admin → AI Health.

- **Run Admin → AI Health → Index everything** once after deploying, so the AI can see leads, bookings, invoices, tasks and payments — not just files.
- **See ROADMAP.md** for what to build next, in order.

- **Appoint the finance team** — Admin → Finance Access. Until you tick people, only Super Admins can see expenses and payments.

- **Run the AI self-test** — Admin → AI Health → "Run the check". Four live probes against Google. Tells you whether the AI actually works, not just whether a key is present.
- **Backfill the UTRs** — Payments Made → "Missing UTR only". Paste each bank SMS and let the AI fill it in.

| # | What | Why it matters |
|---|---|---|
| 1 | **Deploy v11.8** — run `MIGRATION_v11.8_all.sql` in Neon, sync `ameya-heights-crm-v11.8.zip`, Create Deployment | Expense import, UTR tracking, receipts and AI health are all waiting |
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

- **The hourly invite reminders send up to 73 emails over three days.** That is what "every hour" means, and it is a real risk of your domain being marked as spam — which would break every CRM email, not just these. To soften it, change `everyHours: 1` in `src/server/services/onboarding-service.ts` to `4`.


- **A stale extracted copy of the project sits in `CRM/ameya-heights-crm/`.** It is many versions old. If you ever sync *that* folder to GitHub you will deploy an ancient build. Always extract the newest zip fresh, or delete that folder.


- **IFSC is invalid** — 12 characters, must be 11
- **GSTIN corrected** to `29ACOFA6794K1ZG` — validates cleanly now
- **Connector header comment** still says v9.1 and "four triggers"; cosmetic, code is current
- **Single maintainer** — the largest operational risk in the whole system
