# Ameya Heights CRM — UX/UI quick wins (6 batches, 11–16)

These are **six more UX/UI batches, separate from the planned 6–10**, chosen on one
rule: cheap to build on what the app already has, but a visible, everyday
difference for an ordinary user. Each reuses infrastructure that already exists
(the design-system components, the nav-prefs pattern, the format helpers, the
onboarding model), so none is a big build — most are a component plus a sweep.

Ordered by impact for the day-to-day user.

---

## Batch 11 — Create from anywhere ("＋ New")
**The problem.** To start something you first have to *navigate* to the right
screen. Batch 4 put quick actions on the Home page, but nowhere else. A person
three screens deep who wants to jot a task or log a lead has to leave what they
are doing.

**What we build.** A single **"＋ New"** button in the top bar, on every screen,
that opens a short menu — New lead, New task, Record a payment, Upload a document,
Quick note — each permission-gated. It reuses the create flows and actions that
already exist.

**Why it's easy.** One header component plus a dropdown that links to routes and
actions already built. No new data.

**Why it lands.** "Start anything from anywhere" is one of the biggest
convenience jumps a CRM can make, and it costs almost nothing here.

---

## Batch 12 — In-app feedback & "What's new"
**The problem.** There is no way for a user to say "this screen confused me", and
no way for you to know whether any UX change actually helped. Every improvement is
a guess. And when you ship changes, nobody notices them.

**What we build.** A small **feedback button** (a line of text, optionally a
thumbs up/down, tied to the screen they were on) that lands in a simple table you
can read. Plus a **"What's new"** panel that appears once after each release,
listing what changed, from a short changelog config.

**Why it's easy.** One tiny table and action for feedback; the changelog is a
static list shown when the stored "last seen version" differs (the same
localStorage pattern the Recent menu already uses).

**Why it lands.** It closes the loop — you stop guessing and start hearing from
real users — and people feel the app is cared for.

---

## Batch 13 — Every empty screen teaches
**The problem.** A new user constantly hits blank screens ("No records"). A blank
screen is where people get stuck and assume the app is broken or empty.

**What we build.** A sweep so **every** empty state across the app uses the same
friendly pattern: a relevant icon, one plain line saying what belongs here, and a
single primary button to add the first one. The `EmptyState` component for this
already exists — this is about using it *everywhere*, consistently.

**Why it's easy.** Mechanical and low-risk: it's the same component dropped into
each list screen, no new logic.

**Why it lands.** It turns every dead end into a next step, which is exactly where
laymen lose confidence today.

---

## Batch 14 — Readable numbers, dates & money
**The problem.** Numbers show raw ("₹12,50,00,000", "2026-07-14"). People read
lakhs and crores, and "3 days ago", not long strings — and inconsistent formatting
across screens makes the app feel less trustworthy.

**What we build.** One consistent, human way to show money (₹12.5 Cr / ₹4.2 L),
dates ("14 Jul", "3 days ago"), and quantities, applied across the app — with the
exact figure on hover where precision matters.

**Why it's easy.** The formatting helpers already exist; this is standardising the
call sites and filling the gaps. Low-risk, high-coverage.

**Why it lands.** Every screen with a number — which is most of them — becomes
faster to scan and easier to trust.

---

## Batch 15 — "How this screen works" in context
**The problem.** Batch 2 explains individual *terms*. It does not orient someone
who lands on a whole unfamiliar screen — "what is this page for, and what do I do
first?" — especially the heavier ones (Procurement, Capital & Escrow, Programme).

**What we build.** A small, collapsible **"How this works"** note at the top of the
complex screens: two or three plain sentences and the first action to take. Driven
by a simple config keyed to the screen, so it's easy to add and to edit.

**Why it's easy.** It slots into the shared page header we already upgraded in
batch 2; the content is just a config map.

**Why it lands.** It rescues the exact screens where a non-specialist feels lost,
without cluttering the simple ones.

---

## Batch 16 — Recently viewed & pick up where you left off
**The problem.** People work on the same handful of leads, bookings and documents
across a day, but every return trip means searching again. Batch 1 added recent
*menu sections*; this is recent *records*.

**What we build.** A quiet **"Recently viewed"** strip (last leads, bookings and
documents you opened) on Home and in the command palette, so getting back to what
you were doing is one tap.

**Why it's easy.** It reuses the same per-device tracking pattern already built for
the Recent menu — just applied to record pages instead of nav links.

**Why it lands.** It removes a dozen small re-searches a day, which is where a lot
of quiet friction actually lives.

---

## How this fits
- **Distinct from 6–10.** These deliberately avoid overlapping the next block
  (search, visual consistency, mobile, error recovery, accessibility). Run them in
  any order; none depends on another.
- **Cheapest-first, if you want to sequence by effort:** 13 → 14 → 15 (sweeps and
  config) are the lowest-risk; 11 → 16 (small components on existing patterns)
  next; 12 introduces one tiny table.
- **Same quality bar as everything else:** 0 type errors, all tests, all verifier
  checks, production build clean — delivered as its own version, with any SQL and
  the zip separately. Most of these need **no** schema change; only batch 12 adds a
  small feedback table.
