# What's actually working — an honest review

A deep scan of every feature built to date, judged not on whether the code runs
but on whether somebody could do their job with it.

**The headline:** this is not a demo dressed as a product. 1,028 source files,
133 modules of server actions, 247 database models — and only **nine** matches
for "TODO / mock / coming soon" across the entire codebase. Nearly every screen
genuinely queries the database and nearly every module has real, validated,
permission-checked writes. The contractor RA-bill chain is better wired than
most commercial Indian construction ERPs.

The problems are not fake screens. They are three specific things.

---

## Problem 1 — three sets of books that don't talk to each other

This is the most important finding in this document.

You have **three** accounting engines:

| Engine | What posts into it |
|---|---|
| `Voucher` (Cash Book) | Manual entries, Razorpay receipts |
| `JournalEntry` (/ledger) | Only cash-book vouchers and manual journals |
| `TallyVoucher` (Ameya Tally) | **Only** manual entry, CSV import, or the bridge |

**No CRM transaction ever reaches Ameya Tally.** Raise a sales invoice, settle an
RA bill, record a vendor payment — none of it appears in the books. Your
accountant is keeping two sets by hand.

Worse, the middle one is incomplete too: RA-bill settlements, piece-rate
payments, recurring vouchers, vendor-ledger entries and bulk imports all create
a `Voucher` directly and never post the journal entry. **So the trial balance,
P&L and balance sheet omit most of your real money.**

Fixing this is roughly 150 lines: extract the posting function that already
exists and call it from the six places that skip it, then add posting rules for
invoices and vendor bills. It is the single highest-value change available.

## Problem 2 — App Exchange promises 148 integrations and has 4

`src/config/connectors.ts` lists 148 apps, 24 badged "live". The driver registry
has **four**: Slack, Discord, Telegram, Razorpay.

Installing Zoho, HubSpot, Outlook, MagicBricks, Housing.com or Tally Prime
writes a row to the database and shows a green "Installed" badge that means
nothing whatsoever.

**Do not demo this screen to a client.** It is the one genuinely misleading
surface in the product. An afternoon's work fixes it: only offer Install where a
driver exists, and put the rest behind "Request this integration".

## Problem 3 — nine tables nothing reads or writes

`ContractRecord`, `InsurancePolicy`, `Sop`, `LessonLearned`, `WasteManifest`,
`AccessReview`, `PowerOfAttorney`, `JointDevelopmentAgreement`,
`ComplianceDocExpiry`.

The migrations shipped and the tables exist. No code touches any of them — yet
four menu descriptions advertise them ("risk register, contracts and insurance",
"SOPs, decisions and lessons learned", "waste tracking", "incidents and access
reviews"). Either build them or stop advertising them; having both is what makes
a product feel untrustworthy when somebody looks closely.

---

## The one that costs you money today

**Email does not send.** `EMAIL_PROVIDER` defaults to `console`, which writes to
the server log and nothing else. Right now that silently swallows:

- every demand notice and dunning reminder
- password resets and user invitations
- approval notifications and task digests
- **and the new payment reminders in this release**

This is zero code — set `EMAIL_PROVIDER` and the mail credentials. Until you do,
the collections engine you have built is running with the outbox disconnected.

---

## Where things stand, by area

**Genuinely complete:** Sales & Leads · Inventory & Bookings · RA Bills · Cash
Book · Documents · Tasks · Chat · Customer Portal · Snags · Vendor Ledger · TDS ·
Treasury · Budgets · Programme · Quality · Parking · Home Loans · Partners.

**Works, with a gap that blocks real use:** Ameya Tally (isolated) · /ledger
(incomplete posting) · Demands (needs email) · MSME tracker (improved in this
release) · Site Ops (writes a daily log nothing ever reads) · Approvals (only
three triggers) · Automations (nothing fires on money events) · online payment
(no checkout — `/pay` shows bank details and an "I've paid" button).

**Needs a key you probably don't have:** e-Stamping · GSTR-2B · UAN validator ·
BIM viewer · IoT telemetry · telephony · every AI feature. These degrade
honestly — they say they are not configured rather than pretending.

---

## What I would do next, in order

1. **Set up email.** Zero code. Reconnects the entire collections engine.
2. **Post everything to the ledger.** ~150 lines. Turns a decorative trial
   balance into a real one.
3. **Bridge the books to Ameya Tally.** Both engines are balanced-entry already;
   this is a translation layer, not new accounting. Ends the double-entry-by-hand.
4. **Make App Exchange honest.** One afternoon. Removes a reputational risk.
5. **Give Site Ops a consumer** — roll the daily log into programme progress and
   the buyer portal. The capture screen already works; nothing reads it.
6. **Extend approvals to payments** above a threshold. Ten lines, closes the
   biggest internal-control gap.
7. **An add-unit form.** Inventory master data is CSV-only today, which is a
   cliff for a new project.

Items 2 and 3 together are the difference between an impressive CRM and the
system your accountant actually uses.
