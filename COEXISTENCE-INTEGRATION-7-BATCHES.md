# Ameya Heights CRM — coexistence & integration (7 batches)

We've built a lot fast: 24 of 31 feature areas, UX batches 1–16, the first
performance batch (P1) and the first internal-comms batch (C3 work requests),
plus reports, insights, feedback and more. They all **compile, test and build
together** today — every version shipped passed the full suite as one app. What
these batches add is the next level: making the systems **actively help each
other**, and **degrade gracefully instead of breaking** when one depends on
another that isn't available.

Grounded in what already exists — the audit trail, the notifications bell
(`/api/notifications`), the starter-automations engine, RBAC (`can`), departments
& hierarchy, the "database is behind → Fix it now" banner (already a help-don't-
break pattern), error boundaries and `loading.tsx`, `/admin/performance` and
`/admin/errors`, and Web Vitals — so these connect and harden what's there rather
than rebuild it.

Ordered so each batch makes the next stronger.

---

## Batch I1 — Internal event backbone (the spine)
**The problem.** Right now, when something happens (a lead is booked, a payment is
recorded, a work request is raised, a task is completed), each feature wires its
own reactions by hand — or doesn't. That's how systems drift apart.

**What we build.**
- One internal **publish/subscribe event bus**: a small `emit(event, payload)`
  that every meaningful action calls, and any subsystem (notifications, comms,
  audit, automations, reminders) **subscribes** to.
- A typed catalogue of events (`lead.booked`, `payment.overdue`, `workrequest.raised`,
  `task.completed`, …) so producers and consumers agree on the shape.
- Delivery is safe: a subscriber that throws is logged and skipped — it can never
  break the action that emitted the event.

**Help-don't-break angle.** One reliable spine means adding a new system later is
"subscribe to the events you care about", not "edit twenty call sites".

**Builds on.** The audit trail (already an implicit event log) and automations.

---

## Batch I2 — Graceful degradation & resilience ("help, don't break")
**The problem — your exact point.** When one part needs another (AI scoring, email,
a report service, the database being up to date) and that other part is missing or
slow, a screen shouldn't die — it should carry on with a clear, calm fallback.

**What we build.**
- **Dependency guards** around every cross-system call: if the helper is
  unavailable, return a sensible default and a one-line "this bit is unavailable
  right now" instead of a crash.
- **Feature flags / capability checks:** each optional subsystem (AI, WhatsApp,
  integrations) reports whether it's configured; the UI adapts instead of erroring.
- **Section-level error boundaries with retry**, so one broken widget doesn't take
  down the whole page — the rest still works.
- **Generalise the "database is behind" pattern** to every dependency, so a missing
  piece always tells the user what to do, never a white screen.
- **Timeouts & circuit-breakers** on slow external calls so one stuck dependency
  can't hang a request.

**Builds on.** The schema-behind banner, existing error boundaries, `toActionError`.

---

## Batch I3 — Unified notification & inbox hub
**The problem.** Notifications are fragmented: work requests, approvals, mentions,
reminders, announcements and feedback replies each surface (or don't) in their own
way. A person has no single place that means "things that need me".

**What we build.**
- **One inbox** that every subsystem feeds through the event bus (I1): messages,
  work requests, approvals, mentions, reminders, announcements — one unread count
  on the bell, one feed, one "mark read".
- Per-type **preferences** (in-app / email digest / off) so nobody is drowned.
- Deep links: every notification jumps straight to the exact record.

**Help-don't-break angle.** New systems get notifications for free by emitting an
event — no new plumbing.

**Builds on.** The existing notifications bell and `/api/notifications`, I1.

---

## Batch I4 — Universal record linking & "Related activity"
**The problem.** The systems reference the same real things — a lead, a booking, a
unit, a parcel — but mostly can't see each other. A work request about Plot 14, the
tasks it spawned, the documents, the payments and the messages all live apart.

**What we build.**
- A universal **link model**: any record can be linked to any other (work request
  ↔ lead ↔ task ↔ document ↔ payment ↔ message).
- A **"Related activity"** panel on the major records that pulls everything linked
  to it into one timeline, respecting permissions.
- One-click linking, and automatic links (accepting a work request already spawns a
  task — that link becomes visible everywhere).

**Builds on.** The entity links already on work requests (entityType/entityId), the
Decision Log, documents.

---

## Batch I5 — One identity, permission & scope context
**The problem.** As systems multiply, the risk is each one inventing its own idea
of "who can see this" or "which project/department this belongs to". That's how
security gaps and inconsistencies creep in.

**What we build.**
- A single **access-context helper** every subsystem calls: given a user, it
  resolves their departments, roles, project scope and permissions **once**, and
  every feature (comms, work requests, notifications, reports) uses it — no
  bespoke access logic per module.
- **Consistent department/project scoping** so a person sees the same slice of the
  business everywhere.
- An admin view of "who can see/do what across all systems", so access is auditable
  in one place.

**Help-don't-break angle.** A new module can't accidentally leak data — it inherits
the one access context.

**Builds on.** RBAC (`can`, `resolvePermissions`), departments & hierarchy.

---

## Batch I6 — Cross-system automations & routing
**The problem.** The real value of coexistence is systems *doing things for each
other*: "payment overdue → raise a work request to Accounts and notify the owner",
"lead booked → task to Legal for the agreement". Today those chains are manual.

**What we build.**
- Extend the existing **automations engine** to listen on the event bus (I1) and
  act across modules: create tasks, raise work requests, send notifications, post
  announcements — driven by rules admins can configure.
- A library of **starter cross-module rules** for the common hand-offs, on by
  default but editable.
- A safe **dry-run / preview** so a rule can't quietly misfire at scale.

**Builds on.** `starter-automations.ts`, I1, I3, C3 work requests.

---

## Batch I7 — Integration health dashboard & end-to-end tests
**The problem — "please check on that", made permanent.** Coexistence shouldn't be
something we hope holds; it should be continuously proven.

**What we build.**
- A **system-health dashboard**: every subsystem and its dependencies, green/amber/
  red, with the schema-behind check, connection status, and each optional
  integration's configured state in one view (extending `/admin/performance` and
  `/admin/errors`).
- **End-to-end integration tests** that exercise the cross-system flows — raise a
  work request → it spawns a task → it notifies → it audits — so a change that
  breaks a seam fails the build, not production.
- A **dependency map** so it's clear which system leans on which.

**Builds on.** `/admin/performance`, `/admin/errors`, Web Vitals, the test suite.

---

## Where the original 31-batch feature plan stands
24 of 31 feature areas are built. The remaining **7**, and why each is not a quick
add (unchanged from earlier — several need things outside the code):

- **8 — Communications (WhatsApp/Meta):** gated on the Meta app review / API access.
- **11 — Integrations (partner APIs):** needs the external partners' API access and plans.
- **12 — Platform quality (tests, observability, backups):** *largely already present* —
  I7 above finishes much of it.
- **26 — Vendor portal:** a vendor-facing sign-in and portal — a focused build, doable.
- **27 — Site telemetry:** needs hardware (sensors, trackers, drone) — can't be pure software.
- **30 — Extensibility (custom objects):** partly present via custom fields; the full
  runtime object system is a large build.
- **31 — Language / localisation (i18n):** a full multi-language pass — large but doable.

**Buildable now without external dependencies:** 26 (vendor portal), 30 (extensibility),
31 (localisation), and 12 is mostly covered by I7. **Blocked on outside factors:** 8 and
11 (external API access), 27 (hardware).

---

## How to sequence
- **I1 → I2 first.** The event backbone and graceful degradation are the foundation
  everything else leans on — and I2 is the direct answer to "help, don't break".
- **Then I3 → I4 → I6** connect the systems (notifications, linking, automations).
- **I5 runs alongside** as the safety rail, and **I7 last** to lock coexistence in
  permanently.
- **Quality bar, as always:** 0 type errors, all tests, all verifier checks,
  production build clean — each shipped as its own version, SQL and zip separate.
  Most of these are wiring and need little or no schema change; I1 and I4 add a small
  table each.
