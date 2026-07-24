# Ameya Heights CRM — what to build next

_Written 21 July 2026, against build v10.6._

Ordered by what earns its keep soonest for a two-project developer with a small
team, manual UTR payments, and no appetite for paid subscriptions. Each item
says what it costs and what it depends on, because a roadmap that hides its
prerequisites is a wish list.

---

## Tomorrow — small, and you feel them immediately

**1. Payment due list with an ageing view.**
You track what you have paid. You do not yet track what you still owe and to
whom, sorted by how late it is. This is the single most useful screen a
developer looks at each morning. Everything needed is already in the database.
_Free. Half a day._

**2. Duplicate payment detection across parties.**
The UTR check catches an exact repeat. It will not catch the same invoice paid
once to "SV" and once to "SV Enterprises". Fuzzy-match party names and amounts
within a date window and warn before saving.
_Free. Uses the duplicate-service already in the codebase._

**3. Monthly closing pack, generated.**
One button that produces the cash book, payments made, outstanding list and
receipts as a single PDF for your accountant. Right now you export three CSVs
and staple them mentally.
_Free. The PDF machinery already exists._

**4. Apply the letterhead to generated PDFs.**
Staged since v10.1 and still not applied. Invoices and receipts render with a
plain header while the real letterhead sits unused in the brand folder.
_Free. This is genuinely just repositioning content boxes._

**5. Fix the IFSC.**
`KKBK00008556` is twelve characters. Every Indian IFSC is eleven. It is printed
on invoices and receipts going to buyers and vendors. Worth two minutes with a
cheque book to confirm.

---

## This quarter — where the compounding starts

**6. Budget versus actual, per project.**
Set a budget per head — land, approvals, structure, finishing — and show spend
against it. With Four94 and Salavakkam both running, "how much of the approvals
budget is left" becomes a question you ask weekly. Your expense sheet already
categorises naturally: BBMP, BESCOM, contractors, professional fees.
_Free. Needs a budget model and one screen._

**7. Vendor ledger and running balance.**
The Payments page groups by who you paid. It does not net that against what
they billed. A vendor ledger showing billed, paid, balance ends the "how much
is pending for Arun" conversation.
_Free._

**8. Payment approval chain.**
Above a threshold you set, a payment needs a second person to approve before it
posts. You have the approvals service; it is not wired to vouchers. This
matters more as you add people who can record payments.
_Free._

**9. Buyer payment portal.**
Buyers log in, see their schedule, what is due, what they have paid, and
download receipts. Cuts the "please send me the statement" calls to near zero.
_Free. Customer portal scaffolding exists._

**10. Construction milestone tracking with photos.**
Link payment milestones to actual site progress with dated photographs. Both
your buyers and any future lender will ask for exactly this.
_Free. Storage is already Vercel Blob._

**11. Document expiry alerts.**
Approvals, licences, insurance and contracts all expire. Tag documents with an
expiry date and get chased before, not after.
_Free._

---

## When the integrations are live

These unlock only after the app registrations described in
Admin → Connected Accounts.

**12. WhatsApp payment reminders.**
The highest-value integration by a distance. Indian buyers answer WhatsApp and
ignore email. Approved utility templates for "instalment due", "payment
received", "site visit confirmed".
_Meta charges per conversation — paise, not rupees. Needs business
verification, which takes a few days._

**13. WhatsApp two-way inbox.**
Replies land against the lead or buyer in the CRM rather than a personal phone.
This is what stops knowledge walking out when someone leaves.

**14. Facebook and Instagram lead capture.**
Lead Ads forms flow straight into the CRM instead of a CSV somebody downloads
weekly. Response time is the single biggest driver of conversion on paid
property leads.
_Needs App Review for `leads_retrieval`._

**15. Ad spend to booking attribution.**
Join Google Ads and Meta spend to leads and then to bookings, so you can see
cost per booking, not cost per lead. Cost per lead is a vanity number; the
campaign with cheap leads is often the one selling nothing.
_Google Ads requires a Cloud Console project — the thing you have avoided.
Meta does not. If you only do one, do Meta first._

---

## Later — real, but not yet

**16. RERA compliance reporting.** Quarterly returns assembled from the data you
already keep. Worth building the quarter before you need it, not the week.

**17. Broker and channel-partner commission tracking.** Partner screens exist;
commission calculation and payout does not.

**18. Cash flow forecast.** Committed payments out against expected collections
in, twelve weeks ahead. Needs items 6 and 7 first to be worth trusting.

**19. Tally or Zoho Books export.** Whatever your accountant actually uses. Ask
them for a sample import file before building anything.

**20. Site attendance and labour tracking.** Only worth it if you are paying
labour directly rather than through contractors.

---

## Honest notes

**On the AI.** It now indexes documents, leads, bookings, invoices, tasks and
payments, and answers each person only from what they may open. Its usefulness
is capped by how much real data is in the system — which today is very little.
Every feature above gets better as you enter real records, and none of them are
worth much on an empty database. **Importing your actual units, bookings and
payment schedules would improve the AI more than any feature on this list.**

**On what I would not build.** A mobile app beyond the current PWA, a customer
chatbot, and anything predictive about pricing. The first is expensive to
maintain, the second annoys buyers of eight-figure assets, and the third needs
years of transaction history you do not have.

**On order.** If you do nothing else from this list, do items 1, 5 and 12.
