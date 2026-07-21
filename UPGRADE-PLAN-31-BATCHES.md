# Ameya Heights CRM — the full upgrade, in thirty-one batches

_Written 21 July 2026, against build v13.2 (112 tables, 88 screens)._

This is the list you asked for: everything worth building to take the system from
"a very good internal CRM" to the thing you actually run the company on.

_Batches 13 to 31 were added on request, over three rounds. They are not padding:
several cover ground that sits earlier in the sequence than anything in the
original twelve — batch 24 in particular belongs first — and the ordering table at
the end has been rebuilt from scratch each time to say so._

Two honest notes before the list.

**What already exists is more than you probably think.** Leads, bookings, units,
payment milestones, vendors, invoices with GST fields, purchase orders, vendor
bills, material requests, approvals, tasks, calendar, documents with OCR and AI
search, automations, email sequences, floor plans, attendance, snags, channel
partners, leases, drawings and RFIs, incentives, vouchers, receivables and a cash
book are all there. So most of what follows is **depth**, not new territory. That
is the more valuable kind of work and the less exciting kind.

**Three structural gaps sit underneath half this list.** There is no ledger, no
budget, and no schedule. Batches 1, 2 and 5 build those three. Almost everything
else gets better once they exist, and several things are impossible until they do.
If you only do part of this list, do those.

Each batch is roughly two to four days of my time, sized to be deployable on its
own. Nothing here needs a paid subscription unless it says so.

---

## Batch 1 — The ledger underneath everything

**Why first:** you currently record payments, and separately record invoices, and
nothing reconciles the two. Every financial question beyond "what did we pay" needs
a double-entry ledger to answer honestly.

1. **Chart of accounts** — a real account tree (assets, liabilities, income,
   expenses), seeded for a real-estate LLP.
2. **Journal entries, double-entry** — every voucher, invoice, bill and receipt
   posts two sides. Nothing can be recorded that does not balance.
3. **Automatic posting rules** — a vendor bill posts to the right expense head
   without anybody choosing it.
4. **Trial balance, P&L and balance sheet** — generated, not assembled by hand.
5. **Party ledgers** — running balance per vendor, per buyer, per contractor.
   Ends the "how much is pending for Arun" conversation permanently.
6. **Opening balances** — so you can start from today without re-entering history.

_Depends on: nothing. Unlocks: batches 2, 3, 4 and 11._

---

## Batch 2 — Budgets, and knowing where the money went

**Why:** with Four94 and Salavakkam both running, "how much of the approvals
budget is left" is a weekly question with no current answer.

7. **Cost codes / WBS** — land, approvals, structure, finishing, marketing,
   overheads, broken down to the level you actually manage.
8. **Budget per project per cost code** — set once, revised with a trail.
9. **Budget versus actual, live** — committed (POs raised) versus incurred
   (bills received) versus paid. Those three being different is the whole point.
10. **Cost-to-complete and forecast overrun** — the number that tells you about
    a problem while it is still cheap.
11. **Commitment control** — a warning, or a block, when a PO would breach a head.
12. **Variance explanations** — a required note when a head moves more than a set
    percentage, so the reason survives the person.

_Depends on: batch 1. Free._

---

## Batch 3 — Statutory, tax and compliance

**Why:** these are deadlines that do not move and penalties that are automatic.

13. **GST properly** — GSTR-1 and GSTR-3B working data, input credit register,
    reverse charge, e-invoice fields ready.
14. **TDS** — deduction at source on contractor and professional payments, rate
    master, challan tracking, Form 16A data.
15. **RERA quarterly returns** — assembled from data you already keep.
16. **Statutory calendar** — every recurring obligation with an owner and a
    chase-before, not a chase-after.
17. **Document expiry engine** — approvals, licences, insurance, contracts.
18. **Audit pack export** — one button, everything your auditor asks for.

_Depends on: batch 1. Free. Worth doing the quarter before you need it._

---

## Batch 4 — Cash flow and treasury

19. **Twelve-week rolling cash forecast** — committed out against expected in.
20. **Bank statement import and reconciliation** — match statement lines to
    recorded UTRs automatically, flag what does not match. This is the single
    highest-value item in this batch and it needs no payment gateway.
21. **Multi-bank position** — every account, one screen.
22. **Payment run** — select approved bills, produce the bank upload file,
    record UTRs back against them in one pass.
23. **Interest and loan tracking** — drawdowns, repayments, interest accrual.
24. **Cash-flow scenarios** — what happens if Salavakkam slips a quarter.

_Depends on: batches 1 and 2. Free — statement import is a file, not an API._

---

## Batch 5 — Construction programme and progress

**Why:** you track tasks, which is not the same as tracking a project. There is
currently no schedule, so nothing can be late in a way the system understands.

25. **Programme with dependencies** — a real schedule, critical path, float.
26. **Gantt view** — including a printable one, because site meetings use paper.
27. **BOQ and quantities** — the bill of quantities as structured data.
28. **Progress measurement** — percentage complete per item, measured not guessed.
29. **Earned value** — planned versus earned versus actual cost. The honest
    answer to "are we on track", as opposed to the optimistic one.
30. **Milestone-linked payments** — buyer demands raised automatically when a
    construction stage is certified complete, not when somebody remembers.
31. **Dated progress photographs against milestones** — what buyers and lenders
    both ask for.
32. **Delay register** — cause, responsibility, days, cost. Priceless in a dispute.

_Depends on: batch 2 for the cost side. Free._

---

## Batch 6 — Procurement, properly

33. **RFQ to multiple vendors** and a comparative statement generated from the
    quotes — not built in a spreadsheet each time.
34. **Rate contracts** — agreed rates that price a PO automatically.
35. **Goods received notes** — three-way match between PO, GRN and bill. This is
    the control that stops paying for material that never arrived.
36. **Material reconciliation** — issued versus consumed versus wastage.
37. **Vendor performance scoring** — on time, on spec, on price, over time.
38. **Retention and defect liability** — money held back and released on schedule.
39. **Subcontractor running account bills** — the RA-bill cycle with certification.

_Depends on: batches 1 and 5. Free._

---

## Batch 7 — Sales depth and the buyer experience

40. **Buyer portal, properly** — schedule, dues, receipts, documents, progress
    photographs, snag raising, all self-service. Cuts statement calls to near zero.
41. **Inventory and pricing engine** — floor rise, PLC, view premium, discount
    approval matrix with a limit per role.
42. **Booking workflow end to end** — application, allotment, agreement,
    registration, handover, each with its documents and its own clock.
43. **Automatic demand generation and dunning** — staged reminders with escalation,
    over WhatsApp and email.
44. **Interest on delayed payments** — calculated, waivable with approval.
45. **Cancellation and transfer** — refund calculation, deductions, re-inventory.
46. **Broker commission** — slabs, milestones, TDS, payout. Partner screens exist;
    the calculation does not.

_Depends on: batches 1 and 5. Free._

---

## Batch 8 — Communications that stay in the system

**Why:** the knowledge currently walks out on people's phones.

47. **WhatsApp two-way inbox** — replies land against the lead, not a personal
    phone. _Blocked by the Meta business restriction; nothing to build until
    that appeal succeeds._
48. **Email inbox sync, two-way** — the thread against the record.
49. **Call logging and click-to-call** — who called whom, how long, what came of it.
50. **Recording and transcript against the lead** — with consent handling.
51. **Site walkie** — short voice notes against a task, transcribed. You already
    have voice notes; this points them at the work.
52. **Notification discipline** — digests, quiet hours, per-channel choice. Twenty
    automations switched on is only useful if the notifications stay readable.

_Meta charges per WhatsApp conversation — paise, not rupees. The rest is free._

---

## Batch 9 — AI that earns its keep

**Why:** the AI currently answers questions about documents. It could do work.

53. **Document extraction, structured** — read an invoice, bill or agreement and
    fill the record. You have the reading; this is the writing.
54. **Meeting notes to actions** — upload the recording, get minutes and tasks.
55. **Cost anomaly detection** — this bill is 40% above the running rate for the
    same item, and nobody noticed.
56. **Lead scoring on your own history** — once there are enough bookings to learn
    from. Not before; a model trained on forty leads is astrology.
57. **Drafting with your voice** — buyer replies, vendor chasers, notices.
58. **An AI that can act, with a leash** — propose a demand run, a payment run, a
    chase list; a person approves. Same pattern as the automation builder.
59. **Ask anything across every module** — currently documents only.

_Free on the OpenRouter and Groq keys you have. Cost scales with use, not seats._

---

## Batch 10 — Reporting, and deciding from data

60. **Report builder** — pick fields, filter, group, save, share. You have an
    explorer; this is the version other people can use.
61. **Scheduled reports** — the Monday pack lands before the Monday meeting.
62. **Dashboards per role** — what a site engineer needs is not what you need.
63. **Cohort and funnel analysis** — conversion by source, by month, by price band.
64. **Cost per booking by channel** — joining spend to bookings. Cost per lead is
    a vanity number; the campaign with cheap leads is often the one selling nothing.
65. **Board pack, generated** — the monthly deck, from live data.

_Depends on: batches 1, 2 and 5 for anything to report on. Free._

---

## Batch 11 — Integrations with the outside world

66. **Tally or Zoho Books export** — whichever your accountant uses. Ask them for
    a sample import file before this is built; the format matters more than the code.
67. **Banking** — statement import first (free, works today), API later.
68. **Property portals** — 99acres, MagicBricks, Housing leads straight in, instead
    of a CSV somebody downloads weekly. Response time is the biggest single driver
    of conversion on paid property leads.
69. **Meta lead ads** — form submissions into the CRM. _Needs App Review._
70. **Google Ads spend and attribution** — _requires a Cloud Console project,
    which you have deliberately avoided. Meta does not. If you do only one, Meta._
71. **e-signature** — agreements out for signature and back, tracked.
72. **Government portals** — RERA, MCA, GST, as far as each allows.

_Costs vary. The portal integrations usually require a paid API plan from the
portal; that is a commercial decision, not a technical one._

---

## Batch 12 — Making it a platform

**Why:** everything above assumes the foundation holds while it grows.

73. **Multi-entity** — Ameya Heights LLP and whatever comes next, separate books,
    one login.
74. **Proper test coverage** — 100 tests today, most written after a bug. The
    ones worth adding are around money and permissions.
75. **Observability** — know a screen is slow or failing before you tell me it is.
76. **Performance at volume** — the database will behave differently at fifty
    thousand records than at five hundred.
77. **Offline-first field app** — site has no signal; capture should not depend on it.
78. **Backup, restore and a tested disaster drill** — untested backups are a
    rumour, not a backup.
79. **Data retention and DPDP** — what is kept, for how long, and deleting on request.
80. **Design system consolidation** — one set of components, so the twentieth
    screen costs what the fifth did.

_Free. Unglamorous. This is the batch that decides whether batches 1 to 11 age well._

---

## Batch 13 — Land, title and the approvals maze

**Why:** this is the largest genuinely uncovered area in the system, and it sits
*before* everything else in the list. Nothing in 112 tables tracks a title chain,
a liaison file or a pending sanction. For a Bangalore and Tamil Nadu developer
that is the part where money is actually lost — a project cannot be budgeted,
scheduled or sold until the approvals land, and today none of that lives anywhere
but somebody's head and a WhatsApp thread.

81. **Land acquisition pipeline** — parcels from identified through negotiated to
    registered, with owner, extent, survey number and asking rate.
82. **Title chain and due diligence** — the mother deed downwards, encumbrance
    certificate history, each document tagged to the link in the chain it proves.
    A gap in the chain should be visible as a gap, not discovered by a buyer's
    lawyer.
83. **Joint development agreements** — revenue or area share, the developer and
    landowner split, refundable deposit, obligations on each side with dates.
84. **Revenue and municipal records** — khata, patta and chitta, conversion (DC
    conversion), betterment charges, property tax paid-to date. Bangalore and
    Salavakkam need different sets; both should be first-class.
85. **Approvals and sanctions register** — BBMP, BDA, BESCOM, BWSSB, fire, lift,
    pollution board, airport height clearance, TN DTCP and panchayat for
    Salavakkam. Each with applied date, expected date, fee paid, current desk and
    the document when it arrives.
86. **Liaison tracking** — who is chasing what, with whom, since when. Not to
    record anything improper: to stop a file sitting for six weeks because the
    person chasing it was on leave.
87. **Litigation and notices register** — matter, court, counsel, next date,
    exposure, documents. Court dates that pass unnoticed are the expensive kind.
88. **Power of attorney and authorisations** — who may sign what, until when.

_Depends on: nothing. Free. Unlocks honest project start dates, which batch 5
currently has to assume._

---

## Batch 14 — Quality, safety and handover

**Why:** you have snag tickets, which is the last five per cent of this. The
ninety-five per cent before it — inspecting work *before* it is covered up — is
absent. A defect found at handover costs an order of magnitude more than the same
defect found at pour.

89. **Inspection and test plans** — the checklist per activity, agreed once, used
    every time.
90. **Stage inspections with hold points** — reinforcement, shuttering, pre-pour,
    waterproofing. Work cannot be certified complete past a hold point until the
    inspection passes, which is what makes batch 5's progress numbers trustworthy.
91. **Non-conformance reports** — raised, assigned, rectified, verified, closed,
    with photographs at each step and a cost attached.
92. **Material test certificates** — cube tests, steel test certificates, mix
    designs, filed against the pour they belong to.
93. **Safety: incidents, near-misses and toolbox talks** — an incident register
    with root cause, and near-misses recorded, because the near-miss is the free
    warning.
94. **Permits to work** — hot work, height, confined space, lifting. Issued,
    time-bound, closed.
95. **Handover and snagging, properly** — buyer walkthrough, snag list with
    photographs, rectification tracking, sign-off, keys.
96. **Defect liability period and warranties** — what is under warranty, until
    when, whose, and the claim history. Five years of statutory liability is not
    something to track in a folder.
97. **O&M manuals and as-built handover pack** — assembled once, issued to buyers
    and to the association.

_Depends on: batch 5 for the programme to hang inspections off. Free._

---

## Batch 15 — People, payroll and site labour

**Why:** attendance and duty rosters exist; everything that makes them useful does
not. Payroll is currently outside the system, which means headcount cost cannot
reach batch 2's budgets — so "how much of the overheads budget is left" stays
unanswerable no matter how good the budget module is.

98. **Payroll** — salary structure, earnings and deductions, payslips,
    bank transfer file. India-specific and unavoidable: PF, ESI, professional tax,
    gratuity, TDS on salary and Form 16.
99. **Leave and holiday** — entitlement, application, approval, balance, calendar.
100. **Contract labour and site manpower** — headcount by contractor by day
     against what was billed. This is where site cost quietly leaks.
101. **Labour compliance** — licences, wage registers, minimum wage rates, and
     the statutory registers an inspector asks for.
102. **Recruitment and onboarding** — vacancy through offer, then the joining
     checklist that already half exists in onboarding steps.
103. **Appraisals and goals** — reviews on a cycle, against targets that already
     exist for sales.
104. **Skills, certifications and inductions** — who is qualified for what, whose
     safety induction has lapsed. Feeds batch 14's permits.
105. **Expense claims and reimbursements** — submitted, approved, paid, posted to
     the ledger.

_Depends on: batch 1 for posting, batch 2 for budgets. Payroll is the one item on
this whole list where buying rather than building deserves a serious look — the
statutory rules change every budget, and following them is somebody's full-time
job. I would build everything else here and integrate a payroll provider._

---

## Batch 16 — Capital: investors, lenders and RERA escrow

**Why:** the money coming *in* is tracked as buyer receipts and nothing else. The
moment there is an investor, a project loan or a RERA escrow account — and there
will be — the system has no answer to the questions those parties ask monthly.
Escrow in particular is not optional: seventy per cent of buyer receipts are
legally required to sit in a designated account and be withdrawn only against
certified progress.

106. **Capital stack per project** — equity, debt, buyer advances, the split, and
     what it costs.
107. **Investor register** — commitments, drawdowns, units allotted, agreements.
108. **RERA escrow control** — the seventy-thirty split enforced on every receipt,
     withdrawal against architect and engineer certification, and a running
     record of what may still be withdrawn. Getting this wrong is a regulatory
     problem, not an accounting one.
109. **Fund utilisation certificates** — generated from the ledger rather than
     compiled by hand each quarter.
110. **Lender reporting pack** — the monthly pack a bank asks for, produced from
     live data: progress, sales velocity, collections, cost to complete.
111. **Loan covenants** — the ratios you have promised to hold, monitored, with
     a warning before a breach rather than a letter after one.
112. **Drawdown requests** — assembled with the supporting certificates attached.
113. **Distribution waterfall** — preferred return, catch-up, promote. Worth
     building the first time an investor asks, not before.
114. **Investor portal** — statements, drawdown notices, progress, documents. The
     same portal machinery as batch 7, pointed at a different audience.

_Depends on: batches 1, 2 and 5 — escrow certification needs the ledger, the
budget and the certified progress percentage all three. Free, and it is the batch
that makes the company financeable._

---

## Batch 17 — Drawings, technical coordination and BIM

**Why:** drawings, revisions, RFIs, consultants and an issue log all exist — but
as a filing cabinet, not a control. What is missing is the part that stops work
being built to a superseded drawing, which is the most expensive single mistake
available on any site.

115. **Drawing register with controlled revisions** — current issue, superseded,
     and who holds which. A revision that supersedes another should visibly do so.
116. **Transmittals** — formal issue to contractors and consultants, with a
     distribution matrix and an acknowledgement. The record of *who was told what,
     when* is the record that matters in a dispute.
117. **Good-for-construction release workflow** — a drawing reaches site only after
     it is signed off, and site can always see which issue is live.
118. **Technical submittals and material approvals** — the contractor proposes,
     the consultant approves, the approved item is what may be procured. Ties
     batch 6 to what was actually specified.
119. **Consultant coordination and clash issues** — architecture against structure
     against services, with an owner and a date rather than a meeting note.
120. **RFI depth** — clock, escalation, cost and time impact recorded against the
     answer. An RFI answered late is a delay claim.
121. **BIM and IFC model viewing** — the model in the browser, linked to the
     programme and the BOQ. Worth it once, not before.
122. **Mark-up and redlining in the browser** — comment on a drawing without
     downloading, printing and photographing it.
123. **As-built drawings** — captured as work completes, not reconstructed at
     handover from memory.

_Depends on: batch 5 for the programme link, batch 14 for inspections. Free
except a BIM viewer, which is optional and can wait._

---

## Batch 18 — Development appraisal, feasibility and portfolio strategy

**Why:** every number in this system describes projects you have already
committed to. There is nothing for deciding whether to commit to the next one —
which is the highest-stakes decision the company makes, and currently the one
with the least support.

124. **Feasibility model per opportunity** — land, construction, finance, sales,
     over time, producing IRR, NPV, peak funding and profit on cost.
125. **Residual land value** — what a parcel can be worth given a target return.
     The number that decides what to bid, rather than what to hope for.
126. **Scenario and sensitivity** — sale rate down five per cent, construction up
     ten, approvals six months late. Which of those breaks it is the useful output.
127. **Land bank appraisal** — every parcel held, its carrying cost, and what it
     is worth developed against sold.
128. **Project initiation gate** — a documented go/no-go with the appraisal
     attached, so a year later you can see what was assumed.
129. **Actual versus appraisal, tracked to completion** — the discipline almost
     nobody keeps, and the only way the next appraisal gets better.
130. **Portfolio dashboard** — every project by stage, capital employed, exposure,
     and expected completion on one screen.
131. **Absorption and price benchmarking** — your rates and velocity against the
     micro-market, feeding the appraisal rather than sitting in a deck.

_Depends on: batch 1 and 2 for actuals to compare against; batch 16 for the
funding side. Free, and it is the batch that changes what the company buys._

---

## Batch 19 — Handover to the association and the twenty-year tail

**Why:** the relationship with a buyer does not end at handover, and neither does
the liability. Maintenance requests exist; nothing around them does. This is also
the period when reputation is made — the buyer who is looked after for five years
is the one who sends you the next three.

132. **Association formation and handover** — the statutory handover of common
     areas, accounts, corpus and documents to the owners' association, as a
     tracked process rather than an event.
133. **Corpus and sinking fund** — held, invested, drawn, reported.
134. **Common area maintenance billing** — charges raised, collected, aged, per
     unit, with the same dunning machinery as batch 7.
135. **Asset register and AMC contracts** — lifts, pumps, DG sets, STP, fire
     systems: what exists, whose warranty, whose contract, when it expires.
136. **Planned preventive maintenance** — schedules that raise their own tasks,
     which the automation engine can already do.
137. **Helpdesk with an SLA** — complaints logged, escalated on a clock, closed
     with the resident's confirmation rather than the engineer's.
138. **Utility metering and billing** — readings, consumption, recovery.
139. **Gate, visitor and parking management** — visitor passes, staff entry,
     parking allocation, amenity booking.
140. **Society accounts** — a small ledger of their own, or a clean export to
     whoever keeps them.

_Depends on: batch 1 for the ledger, batch 14 for the handover pack. Free._

---

## Batch 20 — Commercial leasing and income-producing assets

**Why:** leases, tenants and rent schedules exist at the level of "we recorded
it". If any part of the portfolio is held for income rather than sold, this is the
difference between an asset and a spreadsheet.

141. **Rent roll** — every tenancy, area, rate, term, escalation, on one screen.
142. **Escalations and rent reviews** — applied automatically on their date, not
     when somebody notices.
143. **CAM reconciliation** — budgeted against actual, recovered against
     recoverable, settled annually.
144. **Security deposits** — held, adjusted, refunded, with interest where due.
145. **Renewals, options and break clauses** — with a warning far enough ahead to
     negotiate rather than accept.
146. **Vacancy, WALE and expiry profile** — how much income falls due for renewal
     and when. The question every lender asks first.
147. **TDS on rent, and tenant-side compliance** — deducted, certified, filed.
148. **Tenant portal and service requests** — the same portal machinery as batch 7
     and 19, pointed at a third audience.
149. **Valuation and yield** — capitalisation on passing and market rent, so the
     asset has a value that updates.

_Depends on: batches 1 and 19. Free. Skip entirely if nothing is held for income._

---

## Batch 21 — Marketing, brand and channel operations

**Why:** campaigns, assets and social posts exist, and batch 11 connects the ad
platforms. What is missing is everything between "we spent money" and "a person
walked in" — including the channel partners who bring a large share of the sales.

150. **Brand asset library with rights and versions** — the current logo, the
     current renders, the current brochure, and nobody using last year's price list.
151. **Campaign budget, approval and spend control** — spend against approved
     budget, posting to batch 2's marketing head rather than sitting apart.
152. **Creative production workflow** — brief, draft, review, approve, publish,
     with the approval recorded.
153. **Landing pages and microsites** — per campaign, with the enquiry form wired
     straight into the CRM and the source tagged correctly. The audit tooling for
     these already exists.
154. **Walk-ins, events and site-visit management** — the funnel step where
     property is actually sold, currently the least instrumented.
155. **Channel partner enablement** — a partner portal with inventory, price list,
     collateral, lead registration and commission visibility. Lead registration in
     particular ends the "who introduced this buyer" argument.
156. **Referral programme** — existing buyers as a channel, tracked and paid.
157. **Reputation and reviews** — what is being said where, and a process for
     answering it.
158. **Competitor and micro-market tracking** — prices, launches, absorption,
     feeding batch 18's appraisals.
159. **Collateral generation** — cost sheets, payment plans and quotes produced
     from live inventory and pricing, so no two people quote differently.

_Depends on: batch 2 for spend control, batch 7 for pricing. Free._

---

## Batch 22 — Governance, risk and internal control

**Why:** the system has permissions, an audit log and approvals. It does not have
*controls* — the deliberate arrangement of who may do what, checked by somebody
else, evidenced afterwards. This is what an auditor, a lender or an incoming
investor will actually test.

160. **Delegation of authority matrix** — every financial commitment has a limit
     and an approver, defined once and enforced everywhere rather than per screen.
161. **Maker-checker across every money movement** — the person who creates a
     payment cannot be the person who releases it. Partly present in approvals;
     it should be structural.
162. **Segregation of duties conflicts** — flagged when granting a role, not
     discovered during an audit.
163. **Risk register** — risks, likelihood, impact, owner, mitigation, reviewed on
     a cycle. Including a heat map that a board will actually look at.
164. **Contract lifecycle management** — every contract, its obligations, its
     renewal date, its exit terms. Obligations are the part everyone forgets.
165. **Insurance register and claims** — policies, cover, expiry, claims history.
     An expired policy discovered after an incident is the worst possible order.
166. **Internal audit programme** — scope, findings, management response, closure.
167. **Policy library with attestation** — the policy, the version, and who has
     read it. Needed for POSH and for most lender checklists.
168. **Whistleblower and POSH case handling** — confidential, restricted, logged.
169. **Board and committee packs** — agenda, papers, minutes, actions, generated
     from live data rather than assembled the night before.

_Depends on: nothing structural, though it is most valuable after batch 1. Free.
This is the batch that makes the company auditable._

---

## Batch 23 — Environment, energy and green certification

**Why:** environmental compliance is already a legal obligation on both projects,
and green certification is increasingly a lending condition rather than a
marketing line. None of it is tracked anywhere today.

170. **Environmental clearance compliance** — the conditions attached to the
     clearance, each with an owner, evidence and a reporting date. Conditions are
     where clearances are actually breached.
171. **Green certification tracking** — IGBC or GRIHA credits targeted, evidence
     collected as work proceeds rather than assembled at the end, when several
     credits are no longer achievable.
172. **Dust, noise and air quality monitoring** — readings against limits, with
     the record that a complaint or an inspection will ask for.
173. **Construction waste and debris manifests** — what left site, where it went,
     who took it. Increasingly required, rarely recorded.
174. **Water: rainwater harvesting, STP performance, consumption** — compliance
     and cost in the same place.
175. **Energy monitoring and embodied carbon** — site energy, then building
     energy after handover, feeding batch 19.
176. **Tree cutting, transplantation and landscape obligations** — permissions,
     counts, survival, which are audited more often than people expect.
177. **ESG reporting pack** — assembled for lenders and investors from the above,
     rather than written from scratch each time it is asked for.

_Depends on: batch 14 for the site processes, batch 19 for post-handover. Free.
Lowest urgency of the twenty-three unless a lender asks — at which point it
becomes the most urgent thing on the list, with a deadline._

---

## Batch 24 — The data platform: migration, quality and history

**Why:** this is the batch that makes every other batch worth having. The system
still runs on almost no real data. Nothing above produces a useful number until
the units, bookings, payment schedules, vendor history and past expenses are
actually inside it — and getting them in cleanly is a project, not an afternoon.

178. **Historical migration** — units, bookings, payment schedules, vendors,
     expenses and past payments brought in from the spreadsheets and Tally, with
     a reconciliation report proving the totals match what they came from.
179. **Import tooling that survives bad data** — preview, validate, correct in
     place, roll back. The existing importer assumes the file is right.
180. **Master data management** — one vendor, not four spellings of it. Merge,
     alias and a canonical record for vendors, buyers and brokers.
181. **Data quality scoring** — completeness and consistency per record, with the
     worst offenders listed so somebody can fix them.
182. **Data dictionary and lineage** — what each field means and where each number
     on a report came from. Ends the "which of these two figures is right" meeting.
183. **A reporting store separate from the live database** — so a heavy report
     cannot slow down somebody entering a payment.
184. **Archival and retention** — old records out of the working set, still
     retrievable, meeting the retention rules from batch 12.
185. **Point-in-time reconstruction** — what did this project's position look like
     on 31 March. Auditors ask this and there is currently no answer.

_Depends on: nothing. **This is the highest-value batch in the entire document**,
and it is the one I would do before any of the others._

---

## Batch 25 — Security operations and resilience

**Why:** the system has strong locks — passkeys, 2FA, device approval, country
rules, rate limits, an audit log. What it lacks is anybody watching. Controls
prevent; operations detect. You asked once whether security was at maximum: this
batch is the honest answer to that question.

186. **Anomalous access detection** — a login at 3am from a new city, a sudden
     bulk export, an account touching finance for the first time. Flagged while
     it is happening rather than found afterwards in the log.
187. **Data loss prevention** — limits and alerts on bulk export and download,
     because the realistic risk is a leaving employee, not a hacker.
188. **Key management and field-level encryption** — bank details, salary,
     identity documents encrypted individually, with rotation.
189. **Session and device governance** — see every active session, end any of
     them, force re-authentication for sensitive actions.
190. **Third-party and vendor security review** — every integration's access
     reviewed on a cycle, tokens rotated, unused ones revoked.
191. **Penetration test and remediation cycle** — an external test, findings
     tracked to closure like any other work.
192. **Incident response runbooks** — what happens in the first hour of a breach,
     written before it is needed, including who is told and by when under DPDP.
193. **Backup verification and a rehearsed restore** — an untested backup is a
     rumour. This drill is booked, run, and its result recorded.
194. **ISO 27001 or SOC 2 readiness** — only if a client or lender asks; the gap
     analysis is cheap, the certification is not.

_Depends on: nothing. Free apart from an external penetration test, which is
worth paying for once._

---

## Batch 26 — The vendor and subcontractor portal

**Why:** batch 6 makes procurement good for you. This makes it good for the other
side, which is what actually reduces your work — every status call a vendor makes
is a call somebody here has to answer.

195. **Vendor self-onboarding with KYC** — GST, PAN, bank details, cancelled
     cheque, MSME status, verified before the first order rather than at first
     payment.
196. **Work orders issued and accepted online** — with a record of acceptance,
     which matters when the scope is later disputed.
197. **Bill and RA-bill submission by the vendor** — with the measurement sheet
     and photographs attached, entering your approval flow directly.
198. **Payment status, self-service** — what is approved, what is scheduled, what
     is on hold and why. This single screen removes most vendor phone calls.
199. **Material dispatch and delivery scheduling** — what is arriving when, so
     site is not surprised and the crane is not idle.
200. **Gate entry and material inward** — checked in against the PO, feeding the
     goods received note from batch 6.
201. **Vendor scorecard, visible to the vendor** — on time, on spec, on paperwork.
     Visible scores change behaviour; private ones do not.
202. **Compliance document expiry** — labour licence, insurance, GST registration,
     chased automatically before it lapses.

_Depends on: batches 1 and 6. Free._

---

## Batch 27 — Site telemetry: plant, vehicles, cameras and drones

**Why:** everything the system knows about site comes from somebody typing it in.
This batch lets the site report itself, which matters most for exactly the things
people are worst at recording: fuel, machine hours and actual progress.

203. **Plant and machinery register** — owned and hired, with utilisation, running
     hours, servicing and idle time. Hired plant sitting idle is invisible today.
204. **Fuel management** — issued against machine and against hours run. The
     classic site leak, and it shows up immediately once measured.
205. **Vehicle and GPS tracking** — movement, trips, and material actually
     delivered where it was meant to go.
206. **Biometric or geofenced labour attendance** — attendance exists; tying it to
     the gate and the site boundary is what makes it true.
207. **CCTV integration** — cameras alongside the record, with clips retrievable
     against an incident or a delay claim.
208. **Drone progress capture** — periodic flights, compared over time, feeding
     the progress measurement in batch 5 with something objective.
209. **Batching plant and weighbridge integration** — concrete produced and
     material received recorded at source, not transcribed later.
210. **Site environmental sensors** — dust and noise feeding batch 23
     automatically instead of by clipboard.

_Depends on: batches 5 and 14. **The only batch here with real hardware cost** —
trackers, sensors, cameras and a drone. Worth pricing before committing._

---

## Batch 28 — Buyer customisation and variation orders

**Why:** buyers ask for changes. Every developer handles this in WhatsApp and
regrets it — the change gets built, the money does not get collected, and the
argument arrives at handover. There is nothing for it in the system today.

211. **Options and upgrade catalogue** — flooring, kitchen, fittings, priced, with
     what is available for which unit type.
212. **Variation requests from buyers** — raised, costed, approved, accepted, with
     the price agreed *before* the work is done.
213. **Cut-off dates by construction stage** — a change to the plumbing layout is
     free in month three and impossible in month fourteen. The system should know
     which, per unit.
214. **Technical feasibility routing** — the request goes to the architect and the
     contractor before a price is quoted, not after.
215. **Variation billing and collection** — added to the buyer's schedule and
     chased with the same machinery as everything else.
216. **Contractor variation orders** — the other side of the same change, so the
     cost side and the revenue side of a variation cannot drift apart.
217. **Sample and show flat management** — what was shown, in what specification,
     which is the standard a buyer will hold you to.
218. **Handover specification per unit** — the as-sold specification including
     every accepted variation, so batch 14's handover checks against the right list.

_Depends on: batches 5, 7 and 14. Free, and it pays for itself on the first
disputed change._

---

## Batch 29 — Institutional memory: SOPs, training and lessons learned

**Why:** the single biggest risk to a company your size is that the knowledge sits
in three people's heads. Every batch above adds capability; this one keeps it when
somebody leaves.

219. **SOP library** — how each process actually runs, versioned, owned, and
     linked from the screen where the work happens rather than filed away.
220. **Process maps** — the same thing as a picture, for the processes that cross
     departments and therefore have nobody in charge of them.
221. **Onboarding academy** — role-based, so a new site engineer is useful in a
     week. Builds on the onboarding steps that already exist.
222. **Training with tracking** — who has been trained on what, feeding the
     competency requirements in batches 14 and 15.
223. **Lessons learned register** — captured per project while it is fresh, and
     surfaced at the start of the next one, which is the part everybody skips.
224. **Post-project review** — a real one, against the batch 18 appraisal, so
     the next appraisal is better than the last.
225. **Decision log** — what was decided, when, by whom, and on what information.
     Invaluable eighteen months later and impossible to reconstruct.
226. **Internal search across everything** — the wiki, the SOPs, the documents and
     the records, in one place. The AI in batch 9 makes this considerably better.

_Depends on: nothing. Free, and the batch most often postponed indefinitely._

---

## Batch 30 — Extensibility: workflow builder, custom objects and an API

**Why:** everything so far is something I build. This batch is about the things
you will want that neither of us has thought of, and being able to add them
without me. Custom fields exist on four entities; there is no way to add a whole
new kind of record.

227. **Visual workflow builder** — the automation engine with branching, delays,
     multi-step approvals and human tasks. What batch 4 of the original list
     started; this finishes it.
228. **Custom objects** — define a new kind of record with its own fields, list,
     detail screen and permissions. The point at which you stop needing me for
     "can we also track X".
229. **Form builder** — internal and public forms, feeding any object, with the
     source tagged.
230. **Approval designer** — build an approval chain visually instead of it being
     coded per module.
231. **Webhooks and a documented public API** — so anything else you buy can talk
     to this. Tokens already exist; the surface does not.
232. **Scripting sandbox** — small, safe custom logic for the cases a builder
     cannot express, running with limits so it cannot take the system down.
233. **A sandbox environment** — a copy of production to try things in. Every
     change so far has been tested against an empty database or against live.
234. **Extension marketplace** — the internal one, so a workflow built for Four94
     can be installed for Salavakkam rather than rebuilt.

_Depends on: batch 12. Free. The most technically demanding batch in the document,
and the one that most reduces your dependence on me._

---

## Batch 31 — Language, accessibility and reach

**Why:** two projects in two states with two languages, and an NRI desk, on a
system that exists only in English. Agreements and notices for Salavakkam
arguably need to be available in Tamil; Four94's buyers and workforce are largely
Kannada-speaking. There is no localisation of any kind in the code today.

235. **Interface in Kannada, Tamil and Hindi** — chosen per person, not per site.
236. **Documents and templates in regional languages** — receipts, notices,
     demand letters and agreements generated in the language they will be read
     in, which for statutory notices is sometimes not optional.
237. **WhatsApp, SMS and email templates per language** — a buyer chased in the
     language they replied in.
238. **Numbers, dates and currency done properly** — the Indian numbering system,
     Indian date order, and foreign currency for NRI buyers with the rate recorded
     at the time.
239. **Accessibility to WCAG AA** — keyboard, contrast, screen readers, larger
     text. Partly there; never tested against a standard.
240. **Site-worker interface** — very large targets, minimal text, icon-led, for
     people who will use it on a cracked phone in the sun with gloves on.
241. **Voice input in regional languages** — voice notes exist; understanding
     Kannada and Tamil is what makes them useful on site.
242. **Multi-region data residency** — only if a jurisdiction ever requires it.

_Depends on: nothing structural, but it touches almost every screen, so it is far
cheaper to do once the screens have stopped changing. Free._

---

## If you want an order

The list above is grouped by subject. The order I would actually build in — all
thirty-one, in one table, rebuilt from scratch again:

| Order | Batch | Why there |
|---|---|---|
| 1 | **24 — Data platform and migration** | Nothing else produces a real number until the real data is in. The highest-value batch here. |
| 2 | **13 — Land, title, approvals** | Sits before everything operational. No honest start date without it. |
| 3 | **1 — Ledger** | Everything financial is guesswork without it. |
| 4 | **2 — Budgets** | Two live projects, no budget control. |
| 5 | **4 — Cash flow** | Bank statement import is still the best value per day in the list. |
| 6 | **5 — Programme** | Nothing can be "late" until there is a schedule. |
| 7 | **14 — Quality and safety** | Hold points make the programme's progress numbers true. |
| 8 | **16 — Capital and escrow** | The day a lender, investor or escrow account exists, this stops being optional. |
| 9 | **7 — Sales and buyer portal** | Where the revenue is, and the phone calls. |
| 10 | **17 — Drawings and coordination** | Cheap, and prevents the most expensive site mistake. |
| 11 | **28 — Buyer customisation** | Pays for itself on the first disputed change. |
| 12 | **3 — Statutory** | Build the quarter before you need it, not the week. |
| 13 | **6 — Procurement** | Once budgets exist, the three-way match starts paying. |
| 14 | **26 — Vendor portal** | Immediately after procurement; it removes the phone calls procurement creates. |
| 15 | **21 — Marketing and channel** | Partner enablement and walk-in tracking pay back fastest. |
| 16 | **15 — People and payroll** | After the ledger and budgets, or headcount cost has nowhere to land. |
| 17 | **10 — Reporting** | Once there is something worth reporting on. |
| 18 | **25 — Security operations** | Prevention exists; detection does not. Before you are big enough to be worth attacking. |
| 19 | **22 — Governance and control** | Before an auditor, lender or investor tests it for you. |
| 20 | **18 — Feasibility and portfolio** | The moment a new site is under consideration, move this to the top. |
| 21 | **9 — AI** | Gets better with every batch above it — now thirty of them. |
| 22 | **29 — Institutional memory** | Do it before somebody important leaves, not after. |
| 23 | **12 — Platform** | Before volume forces it. |
| 24 | **30 — Extensibility** | Once the shape of the system has settled. Reduces your dependence on me more than anything else here. |
| 25 | **31 — Language and accessibility** | Cheapest once the screens stop changing. |
| 26 | **19 — Association handover** | Only once the first tower is near handover. |
| 27 | **27 — Site telemetry** | Only worth it at a scale that justifies the hardware. |
| 28 | **20 — Commercial leasing** | Only if any part of the portfolio is held for income. |
| 29 | **23 — Environment and ESG** | Low urgency until a lender asks, then immediate. |
| 30 | **11 — Integrations** | Mostly gated on other people's approvals. |
| 31 | **8 — Communications** | Gated on the Meta restriction being lifted. |

### What thirty-one batches actually means

Two to four days each, so **roughly three to six months of continuous work** — and
that is build time, not the time it takes your team to adopt any of it. Adoption
is the harder half and it is not on this list.

Twelve of the thirty-one are gated on something other than my time: a lender, an
appeal, a new site, a first handover, an accountant's file format, or hardware
you would have to buy. Those are worth knowing in advance and not worth starting
early.

**The list is now longer than it is sensible to build in order.** Past about the
first ten, sequencing matters more than completeness — the right question stops
being "what else could we add" and becomes "what is costing us money this quarter".
Batches 24, 1, 2 and 4 answer that today. The other twenty-seven are there so that
when something changes — a lender appears, a new site comes up, somebody resigns —
you already know what to reach for.

## Three things I would not build

**A native mobile app.** The PWA already installs. A real app means two more
codebases and an app store relationship, for a team of your size.

**A buyer-facing chatbot.** People spending eight figures want a person. The
portal in batch 7 answers the same questions without the irritation.

**Price prediction.** It needs years of transaction history you do not have.
Anything built now would be confident and wrong, which is worse than nothing.

---

## The one thing that beats all of it

The system still has very little real data in it. **Importing your actual units,
bookings and payment schedules would improve the AI, the reporting and the
dashboards more than any single batch on this list** — and it would make it
obvious which of these twelve you actually need first.
