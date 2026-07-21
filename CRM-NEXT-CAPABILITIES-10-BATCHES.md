# Ameya Heights CRM — new capability areas (10 batches)

A menu of **net-new** capability areas — things the CRM does not meaningfully do
yet, distinct from what's already built (the 24/31 feature areas, UX 1–16,
performance, comms/work-requests, and the coexistence layer). Each is a batch (or
a small cluster) in its own right. Ordered roughly by business impact for a
real-estate developer; pick in any order.

One standing constraint carried through: **online card/UPI payment gateways stay
out** per your rule — collections remain manual-UTR. Anything money-in below means
tracking and reconciliation, not a gateway.

---

## 1. AI Copilot & assistant
A conversational assistant that sits across the whole CRM: ask it questions in
plain words ("which bookings are overdue on payment?"), have it draft a follow-up
message, summarise a lead's history, or suggest the next best action. Builds on
the AI scoring, insights and the "Ask Documents" you already have. **High impact,
medium effort.**

## 2. Buyer Portal 2.0 (self-service)
Turn the buyer side into a real self-service experience: see your unit, payment
schedule and dues, download agreements and receipts, watch construction progress,
and raise a query — without calling the office. Builds on the existing customer
portal and documents. **High impact; the customer-facing half of the product.**

## 3. E-signature & digital agreements
Send agreements, addenda and channel-partner contracts for digital signature,
track who has signed, and store the executed copy against the record. Removes the
print–sign–scan loop. Builds on documents and templates. **High impact, medium
effort.**

## 4. Cost-sheet & offer builder
Generate a branded, accurate cost sheet / offer for a buyer in seconds — unit
price, floor rise, charges, taxes, and a payment plan — as a PDF you can send.
Builds on pricing & commissions and inventory. **High impact for sales, medium
effort.**

## 5. Accounting & tax integration
Two-way sync with the books (Tally / Zoho / similar): push invoices and vouchers,
pull ledger balances, and prepare GST-return-ready summaries — so finance stops
re-keying. Builds on billing, ledger and the statutory calendar. **High impact,
higher effort (external APIs).**

## 6. Snagging, warranty & post-handover care
The life after handover: a snag list per unit at possession, defect tickets with
status, warranty periods, and a resident-facing way to report issues. Builds on
quality & safety and the association/CAM handover. **Medium impact, medium effort.**

## 7. Workflow automation studio (no-code)
A visual builder for rules — "when X happens, do Y" — on top of the event
backbone just shipped: approvals, routing, SLAs, escalations, notifications,
auto-created tasks and work requests, all configurable by an admin without code.
Builds directly on the event bus (I1) and automations engine. **High impact,
medium effort — and it compounds everything else.**

## 8. HR & workforce
Beyond the attendance you already capture: leave, payroll runs, salary slips,
performance reviews and a light recruitment pipeline — so the team's people-admin
lives in one place. **Medium impact, higher effort.**

## 9. Executive BI & predictive forecasting
A leadership layer: executive dashboards, cohort and funnel analysis, sales and
cash-flow **forecasting** with scenarios, and board-ready exports. Builds on
reports, insights, analytics and forecast. **High impact for owners, medium
effort.**

## 10. Listing syndication & portal lead capture
Publish inventory to the property portals (99acres, MagicBricks, Housing) and your
website from one place, and capture the leads they generate straight back into the
pipeline — no copy-paste, no missed enquiries. **High impact for top-of-funnel,
higher effort (external APIs).**

---

## How this sits with everything else
- **Quickest wins / lowest external dependency:** 4 (cost-sheet), 7 (automation
  studio — it rides the event bus already built), 6 (snagging), 9 (BI/forecasting).
- **Highest strategic value but need external services:** 1 (AI copilot — needs an
  AI key), 3 (e-sign provider), 5 (accounting API), 10 (portal APIs).
- **Still pending from the original 31-plan** (separate from this menu): vendor
  portal (26), extensibility/custom objects (30), localisation (31) are buildable
  now; communications/integrations (8, 11) need external API access; site
  telemetry (27) needs hardware.
- **Quality bar, as always:** each ships as its own green version — 0 type errors,
  all tests, all verifier checks, production build clean — with SQL and zip
  delivered separately.
