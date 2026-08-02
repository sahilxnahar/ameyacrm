# v16.5 — the books become real

## Before you deploy

```bash
psql "$DATABASE_URL" -f MIGRATION_v16.5_all.sql
```

Every statement is idempotent; running it twice is safe. It adds two columns,
one index that stops the same document being posted twice, and seeds the voucher
and RA-bill counters from the numbers already in use.

If the `JournalEntry_source_once_idx` index fails to create, the database already
contains duplicate postings from before this release. The migration file carries
the query that finds them. Reverse the surplus entry from the ledger screen —
never `DELETE` it — and run the file again.

## What changed, and why it mattered

### One set of books instead of three

Six places created a payment voucher and only one of them ever posted to the
ledger. RA-bill settlements, piece-rate settlements, recurring payments, vendor
payments, CSV imports and Razorpay collections all wrote to the cash book and
nothing to the ledger — so the trial balance, P&L and balance sheet omitted most
of the money that had actually moved. All six now post through one function.

Invoices and vendor bills post too. Issuing an invoice is what recognises the
sale, raises the receivable and creates the output-GST liability — so there is
now an explicit **Issue** on a draft invoice, and that is the moment it reaches
the books. A vendor bill books the cost and the payable on the day it arrives,
and the new **Pay** on the bills tab clears that payable rather than booking the
cost a second time.

### What you hold back is a liability, not a saving

A contractor payment with TDS, retention or BOCW labour cess deducted used to
book only the net. The cheque is for the net; the cost is the gross, and each
deduction is money you still owe — to the government under s.194C, to the
contractor on defect-liability expiry, and to the welfare board. All three now
stand as liabilities, so the 26Q deposit has a balance to clear against.

### Ameya Tally can be the same books

Tally → Settings → *Mirror the CRM's books into Tally*. Pick a company and
everything the CRM posts from then on appears there; **Catch up the history**
brings across what came before. Idempotent, so nothing is ever duplicated, and
off until you switch it on. The direction is one-way by design: the CRM is where
the transaction happens, Tally is the book of account.

### The approval limit applies to every way money leaves

It used to guard one screen. A ₹40 lakh contractor settlement needed nobody's
approval while a ₹6 lakh vendor payment did. Now contractor settlements,
piece-rate settlements, recurring payments, bill settlements and the cash book
all ask the same question. You cannot approve a payment you raised yourself,
there is a **Reject** with a reason that goes back to whoever raised it, and the
Payments screen leads with what is waiting. A payment awaiting approval is no
longer counted in anybody's paid total, because it has not been paid.

### Things that are now visible instead of silent

- **Email not sending.** `EMAIL_PROVIDER` defaults to `console`, which writes to
  the server log and drops the message. Admins now see that on every screen.
- **Payments not in the ledger.** Posting is deliberately non-fatal — you must be
  able to record a payment before the chart of accounts exists — so the backlog
  is shown on the Ledgers screen with a button that posts it.

### Inventory and site ops

Add a single unit, correct one, or generate a whole tower — floors × units per
floor, numeric or lettered, basements written B1/B2. Re-running after adding
floors adds only the new ones. And a site log now feeds the programme (record
how far an activity got in the same form) and the buyer portal (one tick sends
the day's photo across).

### The nine registers

Contracts, insurance, licence renewals, SOPs, lessons learned, waste manifests,
access reviews, powers of attorney and JDAs all had database tables and no
screens, while four menu descriptions advertised them. They are built, on the
screens that were promising them, and everything with an expiry now appears on
Today's Priorities before the date rather than after it.

## Still open, by your instruction

**App Exchange.** It lists 148 integrations, badges 24 "live", and has four
drivers: Slack, Discord, Telegram, Razorpay. Installing anything else writes a
row and shows a green badge that means nothing. Do not demo that screen.
