# Ameya Heights CRM — ecosystem hardening (8 batches)

We've shipped a lot fast (v14.3 → v14.28): features, the UX programme, coexistence
layer, work requests, the AI assistant, telemetry, internal chat, vendor ledgers,
the vendor portal, and more. Everything is green and builds together — but "green"
means *it compiles and passes tests*, not *it's as fast, consistent and robust as
it can be*. This plan is about the second thing: **make the whole ecosystem run
clean and smooth, sharpen the interface, and take the lag out** — no new features,
just strengthening what's there.

Ordered by impact on the everyday feel.

---

## Batch H1 — Performance & lag removal
**The aim — your "no lag" ask.** Several new screens rebuild everything on every
visit and do more database round-trips than they need.

**What we do.**
- **Cache the expensive reads** (dashboards, vendor ledgers, telemetry overview,
  conversation lists) with tag-based invalidation, and turn off `force-dynamic`
  where the data can tolerate a short cache.
- **Kill the N+1s** introduced by the new modules — the ledger list, telemetry
  per-device readings and the chat conversation list each currently query in a
  loop; fold them into single grouped queries.
- **Paginate / cap** the big lists (payments, messages, readings) with cursors.
- **Trim the polling** — chat and the notification bell poll on a timer; batch and
  back off when idle so they don't hammer the server.

**Why it lands.** This is the batch you *feel* — pages that appear instead of load.

---

## Batch H2 — Real-time layer (chat & notifications)
**The aim.** Chat and notifications currently **poll every few seconds**. A proper
real-time channel makes messages and alerts instant and cuts the constant server
chatter.

**What we do.**
- Add a hosted **real-time transport** (managed WebSocket/SSE pub-sub — the app is
  serverless, so it can't hold sockets itself) with the database as source of truth.
- Push new messages, @mentions, work-request updates and escalations the moment
  they happen; drop the polling.

**Note.** This one needs one external service configured (a realtime provider) —
the rest of the plan needs nothing outside the code. **Higher effort, but it's the
difference between "near-instant" and "instant".**

---

## Batch H3 — UI consistency & polish sweep
**The aim — "the interface becomes much better".** The new screens (chat, ledgers,
telemetry, work requests, vendor portal, assistant) were built fast; a sweep brings
them all up to the elevated design language so the app reads as **one product**.

**What we do.**
- Apply the premium card depth, motion and status-colour language consistently to
  every new screen; align spacing, headers and icons.
- A **loading skeleton** and a designed **empty/error state** for each new route
  (so nothing flashes blank or default).
- Tidy the mobile layout of the new screens (chat, ledgers, telemetry) so nothing
  overflows or cramps on a phone.

**Why it lands.** Consistency is what turns "lots of new screens" into "a polished
system".

---

## Batch H4 — Notifications & inbox unification
**The aim.** The bell is now fed by many systems (work requests, @mentions,
escalations, soon telemetry alerts). Make it one coherent, trustworthy inbox.

**What we do.**
- One **inbox** with correct unread counts, de-duplication, and deep links that
  land on the exact record.
- **Preferences** per type (in-app / email digest / off) so nobody is drowned.
- Route *everything* through the event backbone so a new system gets notifications
  for free.

**Why it lands.** "Message them instead of emailing" only works if people actually
*see* the message — this makes the signal reliable.

---

## Batch H5 — Data integrity & robust imports
**The aim.** The new imports and merges must never corrupt data or choke on messy
input.

**What we do.**
- Harden the **payment/document imports**: bad rows reported (not silently
  dropped), duplicate detection tightened, huge files streamed, clear per-row
  results.
- Make **vendor merge** and **conversation/record deletes** fully clean up
  references (no orphans), inside transactions.
- Validation and sensible defaults on every new form; guard against half-saved
  state.

**Why it lands.** A stronger ecosystem is one you can trust with real, messy data.

---

## Batch H6 — Security & rate-limiting on the new surfaces
**The aim.** The new public / token endpoints (telemetry ingestion, vendor portal,
chat, uploads) need guarding as usage grows.

**What we do.**
- **Rate-limit** the public endpoints (telemetry POST, vendor-portal views, upload
  token issuance, chat sends) so nothing can be hammered or abused.
- A quick **access-control review** of every new surface — confirm each checks
  membership/permission server-side (chat, ledgers, work requests already do; make
  it uniform).
- Token hygiene: rotation and expiry on portal/device keys.

**Why it lands.** Strong means safe under load, not just fast on a good day.

---

## Batch H7 — Integration tests across the new flows
**The aim — "make sure everything works, cleanly".** Lock the ecosystem so a change
can't quietly break a seam between systems.

**What we do.**
- **End-to-end tests** for the cross-system journeys: raise a work request → it
  spawns a task → notifies → links; send a chat with an @mention → the person is
  notified; import payments → ledgers build → merge consolidates.
- Run them in the build, so a regression fails CI, not production.

**Why it lands.** This is what keeps "everything works" true *after* the next ten
changes.

---

## Batch H8 — Health & observability dashboard
**The aim.** See lag and breakage before your users do.

**What we do.**
- A **system-health view**: every subsystem and its dependencies, green/amber/red,
  with the schema-behind check, connection status, and each integration's configured
  state in one place.
- **Slow-query and slow-route logging** surfaced (building on the logging already
  added), so the worst offenders are visible and fixable.

**Why it lands.** You can't keep an ecosystem fast and clean if you can't see where
it isn't.

---

## How to sequence
- **H1 first** — it's the lag you feel today, and it needs no external anything.
- Then **H3 → H4 → H5** to make it consistent, reliable and trustworthy.
- **H6 → H7 → H8** to make it safe, regression-proof and observable.
- **H2 (real-time)** whenever you're ready to add one external service — biggest
  "wow", but the only batch with an outside dependency.
- **Quality bar, as always:** each ships as its own green version — 0 type errors,
  all tests, all verifier checks, production build clean. Most need little or no
  schema change.
