# Ameya Heights CRM — the interface & performance upgrade, in nineteen batches

_Written 21 July 2026, against build v14.7 (147 tables, 96 screens). Batches 14–19
added on request — reactivity, deeper performance, quality-of-life and the
technology platform itself._

This is a separate track from the 31-batch feature plan. Every batch here is
**purely interface, performance, experience, reactivity or platform** — none of it
adds a new business capability, all of it makes the capabilities you already have
faster, more responsive, nicer to use and cheaper to keep building. The two tracks
interleave: you can slot one of these between feature batches whenever the app
starts to feel heavy, stale or inconsistent.

Batches 1–13 are the interface and front-end performance. Batches 14–19, added
later, go a layer deeper: how the app *reacts* in real time, how it behaves on a
bad connection, the power-user ergonomics that make daily work quick, instant
search, and the underlying technology and delivery machinery — the parts that
decide whether the next fifty screens ship as smoothly as feel to use.

Two honest notes before the list.

**The system has grown faster than its polish.** Ninety-six screens were built in
a hurry, and it shows in a specific, fixable way: nearly every screen hand-rolls
its own `Tile`, `Field`, `inputCls`, `AddButton` and `Empty` components inline.
There are now a dozen slightly-different definitions of the same button. That is
not laziness — it is what shipping fast looks like — but it means the twentieth
screen costs what the fifth did instead of a fraction, and a visual change has to
be made in ninety-six places. **Batch 1 pays for the other twelve**, and it is
the one I would do first.

**Most of the performance work is latent, not urgent.** The app is fast today
because it has almost no data in it. Several things that are invisible now — every
page is `force-dynamic`, every table loads every row, the whole lucide icon set is
imported per screen, nothing is cached — become the difference between snappy and
sluggish the moment real units, bookings and payment history land (feature batch
24). Better to build the machinery before the data arrives than to diagnose it
after.

Each batch is roughly two to four days, sized to be deployable on its own and to
keep all four checks green (`tsc`, `vitest`, `verify.py`, `prisma validate`).
None of these needs a paid subscription.

---

## Batch 1 — The design system: one set of components, built once

**Why first:** everything below is cheaper once this exists, and every screen
built after it is cheaper forever. Right now `Tile`, `Field`, `AddButton`,
`Empty`, the `inputCls` string and the primary-button class are copy-pasted into
`land-view`, `treasury-view`, `programme-view`, `quality-view`, `capital-view`
and every screen before them. They have already drifted.

1. **A real component library** in `src/components/ui/` — `Button`, `Input`,
   `Select`, `Textarea`, `Checkbox`, `Field`/`FormRow`, `Card`, `Badge`,
   `StatTile`, `Tabs`, `Table`, `EmptyState`, `Toast`, `Dialog`, `Chip` — each
   with the variants the app actually uses (primary/secondary/ghost/destructive
   buttons, the brass active state, the coarse-pointer sizing).
2. **One `<StatTile>`** to replace the five different tile components now living
   in the finance and site screens, with a single rule for the "bad" red state.
3. **One `<DataTable>`** with sorting, an empty state, a sticky header and the
   `min-width: 0` flex fix baked in, so no future screen re-learns why text
   overflowed its box.
4. **A `<FormRow>` + `<Field>`** pair that owns label, hint, error and spacing,
   so a form is a list of fields, not forty lines of Tailwind.
5. **A verifier check** that fails the build if a screen re-declares a local
   `inputCls`, `Tile` or `AddButton` — the same discipline that already guards
   permissions and secrets, pointed at component drift.
6. **Storybook-free component gallery** at `/admin/components` (dev-visible), so
   the set is documented by existing rather than by a README nobody reads.

_Depends on: nothing. It is the foundation the other twelve stand on. Free._

---

## Batch 2 — Perceived performance: streaming, skeletons and optimism

**Why:** the fastest thing you can do for how the app *feels* costs no database
work at all. Today every screen is `export const dynamic = 'force-dynamic'` and
blocks on its slowest query before anything paints. A user staring at a white
page for 600ms thinks the app is slow even when the query is fast.

7. **`loading.tsx` per route** — an instant skeleton in the shape of the page
   that is coming, so navigation feels immediate.
8. **Streaming with `<Suspense>`** — the page shell, header and navigation paint
   at once; each heavy panel (the reconciliation list, the earned-value roll-up)
   streams in as its data resolves, instead of the whole page waiting on the
   slowest one.
9. **Optimistic UI on the common actions** — marking a task done, passing an
   inspection, confirming a reconciliation match: the row updates the instant you
   click, and rolls back only if the server disagrees. `useOptimistic` (React 19)
   is already available.
10. **Instant navigation** — route prefetching on hover for the sidebar and the
    common in-page links, so the next screen is often already there.
11. **A consistent pending vocabulary** — spinners become skeletons, buttons show
    a single shared busy state, and nothing ever silently does nothing for a
    second (the sign-out double-tap bug was a symptom of this gap).

_Depends on: batch 1 for the skeleton components. Free, and the highest
feel-per-day in this track._

---

## Batch 3 — The data layer: queries that stay fast at volume

**Why:** this is the batch that decides whether the app is still quick at fifty
thousand records. None of it is visible today because the tables are nearly empty.

12. **Kill the N+1s** — the service functions that load a list and then compute
    per-row totals (the budget-vs-actual roll-up, the party ledgers, the
    quality overview) should do it in one query with aggregation, not a loop.
13. **Indexes for the reads that matter** — audit the actual query shapes and add
    the composite indexes they need; several list screens filter and sort on
    columns that are not indexed together.
14. **Cursor pagination in the services** — every `findMany` that can grow
    unbounded gets a limit and a cursor, so a big project cannot load ten
    thousand rows into a serverless function.
15. **Caching with tags** — `unstable_cache` and `revalidateTag` for the reads
    that rarely change (the chart of accounts, cost codes, the data dictionary,
    project lists) so they are not re-queried on every navigation. Today nothing
    is cached; `force-dynamic` is everywhere by default rather than by need.
16. **A reporting read path** — the heavy roll-ups (trial balance, earned value,
    cash forecast) computed against a cached snapshot, so a big report cannot
    slow down somebody entering a payment. (The dedicated reporting store is
    feature batch 24; this is the query-side groundwork.)
17. **Connection discipline** — confirm every hot path uses the pooled URL and
    releases promptly; the pooler is configured but not audited under load.

_Depends on: nothing, but most valuable just before real data lands. Free._

---

## Batch 4 — Bundle, rendering and assets

**Why:** the JavaScript the browser downloads and the work it does on the main
thread are the other half of speed, and both have easy wins here.

18. **Fix the icon imports** — every screen does
    `import { ... } from 'lucide-react'` with a long barrel list; ensure the
    build tree-shakes to only the icons used, or switch to per-icon imports. This
    alone can cut a meaningful slice off every bundle.
19. **Lazy-load the heavy client components** — charts, the Gantt, any rich
    editor, the map — behind `next/dynamic`, so a screen that does not show them
    does not ship them.
20. **Audit the server/client boundary** — every `'use client'` is a bundle cost;
    several components marked client could be server components with a small
    client island. Push interactivity to the leaves.
21. **`next/image` everywhere** — progress photos, floor plans, brand assets and
    document thumbnails served in modern formats at the right size, not the raw
    upload.
22. **Font loading** — Cormorant Garamond, Inter and Unbounded loaded with
    `next/font`, subset, with `font-display: swap`, so text never blocks paint
    and the display serif does not flash.
23. **A bundle budget** — `@next/bundle-analyzer` wired up, and a recorded
    baseline, so a future import that balloons a route is visible in review.

_Depends on: nothing. Free._

---

## Batch 5 — Tables and lists at volume

**Why:** the CRM is, in honest truth, a hundred tables and lists. They are the
app. When one of them holds five thousand rows, rendering them all is the thing
that will make a phone stutter.

24. **Virtualised rows** — long tables and lists render only what is on screen.
25. **Server-side sort, filter and paginate** — the table asks the server for
    page two, sorted by that column, filtered by that chip, instead of loading
    everything and doing it in the browser.
26. **A saved-view-aware `<DataTable>`** — column choice, sort and filters that a
    user can save, building on the saved-views machinery that already exists.
27. **Density and column controls** — comfortable/compact, show/hide columns,
    because a site engineer and an accountant want different columns on the same
    data.
28. **Bulk selection and actions** — select many rows, act once, with a clear
    count and an undo, done in one consistent pattern rather than per screen.

_Depends on: batches 1 and 3. Free._

---

## Batch 6 — Navigation and information architecture

**Why:** the sidebar now has ninety-six destinations. It has quietly become the
hardest part of the app to use — not because any one screen is bad, but because
finding the right one is getting slower.

29. **A real command palette** — the `⌘K` box in the top bar becomes a launcher:
    jump to any screen, any recent record, any action, by typing. This is the
    single biggest usability win available for a system this size.
30. **A grouped, collapsible, searchable sidebar** — sections that remember their
    open state, a filter box, and per-person favourites pinned to the top. The
    "Customise this menu" affordance already hinted at this.
31. **Recents and pinned records** — the last things you touched, one click away,
    across modules.
32. **Breadcrumbs and a consistent page header** — every screen says where it is
    and how to get back, from one `<PageHeader>` that also owns the primary
    action button.
33. **Global search that spans modules** — one search that returns leads,
    vendors, bookings, documents and now parcels, approvals and activities,
    routed to the right screen. (The AI cross-module search is feature batch 9;
    this is the fast, exact-match version.)

_Depends on: batch 1. Free._

---

## Batch 7 — Forms and input

**Why:** almost every write in the app happens through a form, and the forms are
currently raw native inputs with a submit button. This is where a non-developer
owner feels friction most, because filling things in is most of what he does.

34. **Inline validation** — errors shown against the field as you go, not a wall
    of text after submit; the Zod schemas that already guard the actions can
    drive the client messages too.
35. **Searchable selects (comboboxes)** — a project, a vendor, an activity picked
    by typing, not scrolling a long `<select>`. Critical once the master data is
    real.
36. **Proper money and number inputs** — the Indian numbering system
    (₹1,50,000), correct decimal handling, and never the `toPaise('abc') → 0`
    class of bug reaching the server.
37. **A real date picker** — with sensible Indian date order, keyboard entry and
    quick ranges, replacing the bare `<input type=date>`.
38. **Autosave and draft recovery** on the longer forms, so a dropped connection
    on site does not lose ten minutes of entry.
39. **Multi-step flows** for the genuinely long ones (a booking, a budget), with
    progress and the ability to come back.
40. **"Fill everything in" honoured in the UI** — sensible defaults, smart
    prefills and copy-ready outputs, matching the standing rule that the owner
    pastes finished artefacts rather than filling blanks.

_Depends on: batch 1. Free._

---

## Batch 8 — Dashboards and data visualisation

**Why:** the numbers exist now — a ledger, budgets, a programme, escrow — but they
are shown as tables of figures. A developer glances at a chart; nobody reads a
trial balance for the trend.

41. **A charting foundation** — one small, accessible chart set (line, bar,
    donut, sparkline) that reads as one system in light and dark, so every module
    draws its charts the same way rather than each picking a library.
42. **The dashboard, redesigned** — from static tiles to a live, glanceable
    picture: collections trend, cash runway, sales funnel, programme health, all
    from real data.
43. **Per-role dashboards** — what a site engineer needs is not what the owner
    needs; the same data, arranged for the person. (The reporting depth is feature
    batch 10; this is the visual layer.)
44. **Sparklines and trend indicators** on the stat tiles — a number with its
    direction is worth far more than a number.
45. **A KPI system** — the tiles become a documented, consistent set with targets
    and thresholds, not a bespoke row per screen.
46. **Print and export** — a dashboard or report that prints cleanly to a PDF for
    a site meeting or a board pack, using the letterhead machinery that exists.

_Depends on: batches 1 and 3. Free. Use the design-system chart rules, not a
per-screen library choice._

---

## Batch 9 — Motion, micro-interactions and feedback

**Why:** the difference between an internal tool and a product people like using
is mostly in the small moments — the press of a button, the arrival of a toast,
the transition between tabs. The app currently has almost none of this, and where
it does it is inconsistent.

47. **A single toast/notification system** — every action confirms or fails the
    same way, replacing the ad-hoc `msg` state re-implemented in each view.
48. **Meaningful transitions** — tabs, panels, dialogs and list changes animate
    just enough to be legible, never enough to be slow.
49. **Button and interactive states** — hover, active, focus, disabled and busy,
    consistent everywhere, with the 300ms tap delay already handled by
    `touch-action` extended to the whole set.
50. **Empty, loading and error states with personality** — the app already writes
    good empty-state copy; give it a consistent visual and the occasional
    illustration.
51. **Respect `prefers-reduced-motion`** — every animation has a still fallback,
    which is both an accessibility requirement and a courtesy.

_Depends on: batches 1 and 2. Free._

---

## Batch 10 — Dark mode, theming and visual identity

**Why:** the charcoal/sand dark mode exists but is unpolished, and the brass
identity is applied unevenly. This batch makes the app look deliberate.

52. **Dark mode, finished** — every screen, every component, correct contrast,
    no leftover light-mode surfaces, the emblem gradients holding up on charcoal.
53. **A tightened token system** — colour, spacing, radius, elevation and
    typography as a documented scale in `brand.ts`, so "a bit more padding" is a
    token change, not a hunt through Tailwind classes.
54. **Typography as a system** — a real type scale for Cormorant Garamond
    display and Inter body, with Unbounded used sparingly and on purpose, applied
    consistently instead of per-screen `text-xl font-semibold`.
55. **Elevation and depth** — a consistent, restrained shadow and border language
    so cards, popovers and dialogs sit in a clear hierarchy.
56. **Per-person appearance** — light/dark/system, and a density preference,
    remembered per user.
57. **A polish pass, screen by screen** — the unglamorous walk through all
    ninety-six, fixing the spacing, alignment and wording that a fast build left
    rough.

_Depends on: batch 1. Free._

---

## Batch 11 — Mobile and the field experience

**Why:** the app installs as a PWA and is used on site, on phones, sometimes on a
cracked screen in the sun. The Kanban is already read-only on touch and the
`min-width: 0` fixes exist, but most screens are still desktop tables squeezed
onto a phone.

58. **Tables that become cards on mobile** — the single most impactful mobile
    change; a row of twelve columns is unreadable on a phone and fine as a card.
59. **Touch targets and reach** — everything tappable sized for a thumb, primary
    actions within reach, a bottom navigation for the most-used destinations.
60. **A field-first mode** — large targets, minimal text, icon-led, for capturing
    attendance, progress, a snag or a safety near-miss with gloves on. (The
    regional-language voice input is feature batch 31; this is the layout.)
61. **Offline-tolerant capture** — the things done on site (progress, photos,
    attendance) queue when there is no signal and sync when there is, building on
    the offline groundwork already present.
62. **Install and update polish** — a clean install prompt, a clear "new version
    available" flow, and app icons and splash that look intentional.
63. **Camera-native photo capture** — progress and snag photos taken in-app,
    compressed client-side before the Blob upload, tagged to the record.

_Depends on: batches 1 and 5. Free._

---

## Batch 12 — Accessibility to WCAG AA

**Why:** partly there, never tested against a standard. Accessibility is also just
good interface — the fixes that help a screen-reader user help everyone.

64. **Keyboard everything** — every action reachable and operable without a
    mouse, visible focus rings (the `focus-ring` class is a good start), and no
    keyboard traps in dialogs and menus.
65. **Screen-reader correctness** — semantic markup, ARIA where the semantics run
    out, labelled forms, announced toasts and live regions for the things that
    update.
66. **Contrast to AA** — audit the brass-on-sand and muted-foreground
    combinations, several of which are likely below 4.5:1, and fix the tokens
    once so every screen inherits it.
67. **Focus management** — focus moves sensibly when a dialog opens, a form
    errors, or a route changes.
68. **Larger-text and zoom resilience** — the layout holds at 200% zoom and with
    the OS text size turned up, which the `min-width: 0` work already helps.
69. **An automated a11y check** — axe run in the test suite so a regression is
    caught in review, in the spirit of the existing verifier.

_Depends on: batches 1, 7 and 9. Free._

---

## Batch 13 — Performance observability and budgets

**Why:** the batch that keeps the other twelve from decaying. Performance and
polish rot silently; without measurement, the app is fast until one day it is
not, and nobody knows which change did it.

70. **Real-user timing** — capture Core Web Vitals (LCP, INP, CLS) from actual
    use, per route, so "the dashboard feels slow" becomes a number.
71. **A performance budget in CI** — Lighthouse against the key routes on every
    build, failing if a route regresses past a threshold, exactly as `verify.py`
    fails on a structural regression.
72. **Slow-query visibility** — log and surface the database queries that cross a
    time threshold, so the N+1 that batch 3 missed announces itself.
73. **A bundle-size guard** — the baseline from batch 4, enforced, so a heavy
    import is caught before it ships.
74. **An error and jank monitor** — client errors and long tasks reported (into
    the existing monitoring), so a broken or stuttering screen is known before
    the owner sends a screenshot.
75. **A visible health page** — one `/admin/performance` screen showing the
    route timings, bundle sizes and slow queries, so the state of the app's speed
    is a thing you can look at, not a feeling.

_Depends on: batch 4 for the bundle baseline. Free apart from optional hosted
monitoring, which the existing self-hosted approach can avoid._

---

## Batch 14 — Real-time and live reactivity

**Why:** the app is request-and-response. You do a thing, then reload to see the
result; a number is true as of the last time the page loaded. For a system a team
uses at the same time — one person recording a payment while another watches
collections, a site engineer passing an inspection the office is waiting on — that
is a real gap. Making the app *react* is the difference between a database with
forms and something that feels alive.

76. **Live data without a refresh** — the dashboard tiles, the approvals queue,
    the reconciliation list and the notification bell update themselves as the
    underlying data changes, rather than showing a stale number until F5.
77. **A live notification bell** — the count and the drawer update in real time;
    an approval you need lands while you are looking at another screen.
78. **Presence and "someone is here"** — on the records more than one person
    touches (a booking, a lead, a budget), a quiet indicator of who else is
    viewing or editing, so two people do not silently overwrite each other.
79. **Edit-collision protection** — a gentle "this was changed since you opened
    it" rather than a last-write-wins clobber, which the audit log currently only
    lets you discover *after* the fact.
80. **Live counters and badges** — the sidebar and tabs carry live counts (open
    approvals, unmatched bank lines, failed inspections) so the work announces
    itself instead of waiting to be found.
81. **The transport, chosen for Vercel Hobby** — persistent WebSocket servers do
    not fit serverless, so this is built on Server-Sent Events and disciplined
    short-polling, which are free and sufficient at your scale. A hosted realtime
    service (Pusher, Ably, Supabase Realtime) is the paid upgrade path if the team
    ever outgrows it — a commercial decision, not a technical necessity.

_Depends on: batch 2 for the optimistic-update groundwork. Free on the
SSE/polling path; the standing "no new billing surprises" rule is respected._

---

## Batch 15 — Resilience: offline-first, background sync and a bad connection

**Why:** a construction site has no signal at the back of the basement and patchy
signal everywhere else. Batch 11 makes the app *look* right on a phone; this makes
it *keep working* when the network does not. Today a dropped request is a lost
action and an unhelpful error.

82. **A network-aware data layer** — the app knows when it is offline, tells the
    person plainly, and stops pretending a failed save succeeded.
83. **A write queue with background sync** — an action taken offline (attendance,
    a progress update, a snag, a safety near-miss) is queued locally and syncs
    itself when the signal returns, using the service worker already present.
84. **Read caching, stale-while-revalidate** — the screens a field user needs open
    instantly from cache and quietly refresh, rather than spinning on a bar of
    signal.
85. **Retry with backoff, everywhere** — the bounded `fetchWithTimeout` gains a
    retry policy, so a flaky third party or a momentary drop recovers on its own
    instead of surfacing as a failure.
86. **Conflict resolution that a person can understand** — when an offline edit
    and a server change disagree, a clear choice, not a silent overwrite. Builds
    on batch 14's collision detection.
87. **Graceful degradation** — every screen has a sensible partial state when a
    piece of it cannot load, extending the `PageLoadError` philosophy (name what
    is wrong) to the whole surface instead of a blank panel.

_Depends on: batches 2 and 11, and it pairs with batch 14. Free._

---

## Batch 16 — Power-user quality of life

**Why:** the people who live in the app all day are slowed by small frictions a
hundred times a day — opening a form to change one number, scrolling a list to
find a record, losing a bulk action to a misclick with no undo. This batch is the
accumulated set of "why can't I just…" fixes.

88. **Inline, spreadsheet-style editing** — change a cost, a quantity, a status
    directly in the table cell, tab to the next, without opening a form. The
    single biggest daily time-saver for finance and site entry.
89. **Keyboard shortcuts throughout** — new record, save, search, navigate a list,
    move between tabs, all from the keyboard, with a discoverable `?` cheat-sheet.
90. **Quick-add from anywhere** — capture a lead, a task, a voucher or a snag from
    a global shortcut without leaving the screen you are on, extending the
    command palette from batch 6 into actions, not just navigation.
91. **Undo, and safe destructive actions** — a short-lived undo on the things that
    bite (a bulk change, a delete, a status flip), so a misclick is a shrug, not a
    recovery job.
92. **Saved filters and views, shared** — a filter set saved, named and shared
    with a team, on top of the saved-views machinery that exists.
93. **Templates and smart defaults** — start a budget, a booking, an inspection
    plan from a template, and let the app pre-fill what it can infer, honouring
    the "fill everything in" rule at the point of entry.
94. **Duplicate, bulk-edit and reassign** — clone a record as a starting point,
    change a field across many at once, hand a queue of work from one person to
    another, in one consistent pattern.

_Depends on: batches 1, 5 and 6. Free._

---

## Batch 17 — Instant search and smart filtering

**Why:** finding a record is one of the most frequent things anyone does, and
today it is a scroll or a page reload. As the data grows past a few hundred rows,
fast retrieval stops being a nicety and becomes the thing that decides whether a
screen is usable at all.

95. **Instant, typeahead search** — results as you type, debounced, ranked, across
    the record types that matter, returning in tens of milliseconds rather than a
    round-trip-per-keystroke.
96. **Fuzzy and forgiving** — "ashok cement", "Ashok Cements" and a transposed
    letter all find the vendor, reusing the normalisation the dedupe engine
    already uses.
97. **Faceted filtering** — narrow a list by several dimensions at once (project,
    status, owner, date range) with the counts shown, and the URL carrying the
    state so a filtered view is shareable and bookmarkable.
98. **Postgres full-text where it earns it** — a proper search index on the
    high-volume text (leads, vendors, documents, now parcels and activities), so
    search is a database strength rather than a table scan.
99. **Recent and suggested** — recent searches and records surfaced, because the
    thing you want is usually the thing you just had.
100. **Scoped search in every list** — every table gets a fast local search box
     with the same behaviour, so the pattern is learned once and used everywhere.

_Depends on: batches 3 and 6. Free — this is Postgres and a good index, not a
search service._

---

## Batch 18 — Platform and runtime modernisation

**Why:** the app runs on a modern stack (Next 15, React 19), but not yet on the
parts of it that make an app fast and safe almost for free. This batch adopts the
technology that is already in your dependencies but not yet switched on, and
hardens the runtime.

101. **The React Compiler** — automatic memoisation across the app, so the
     re-render cost that creeps in as screens grow is handled by the build rather
     than by hand-written `useMemo` nobody maintains.
102. **Partial Prerendering and smarter rendering** — the static shell of a page
     served instantly with the dynamic parts streamed in, replacing the blanket
     `force-dynamic` with a per-page decision. Pairs with batch 2.
103. **Turbopack for local development** — faster cold starts and hot reloads,
     which is quality of life for whoever is building, and compounds over every
     future batch.
104. **Route-level error boundaries** — an `error.tsx` per section so one screen's
     failure is contained and recoverable in place, not a whole-app white screen.
     The crash-reporter-that-crashed bug from the feature handover is the reason
     this matters.
105. **Stricter TypeScript and lint** — turn on the remaining strict flags and a
     tightened lint config, catching a class of bugs before they run, in the same
     spirit as `ignoreBuildErrors: false`.
106. **Feature flags** — ship a batch dark, turn it on for yourself first, roll it
     back without a redeploy. The safe way to keep shipping fast onto a live
     system the company runs on.
107. **Dependency and security hygiene** — automated dependency updates with the
     test suite as the gate, and a routine audit, so the stack does not quietly
     rot or accumulate known vulnerabilities.

_Depends on: nothing, though it is most valuable before the app gets much bigger.
Free._

---

## Batch 19 — Delivery velocity and developer experience

**Why:** the honest constraint on this whole system is how fast and how safely a
new screen can be built and shipped onto production without breaking the thing the
company runs on. Several steps are still manual — the schema is registered by hand
in two places every batch, screens are tested against an empty database, a bad
deploy is found by the owner sending a screenshot. This batch is the machinery
that makes the next fifty batches faster and safer than the last fifty.

108. **Automate the two-place schema registration** — adding a model should update
     `init-schema-sql.ts` and `schema-check-service.ts` by codegen, not by memory.
     This is the single most error-prone manual step in the current workflow and
     it is fully automatable.
109. **Seed and demo data** — a generator that fills a database with realistic
     units, bookings, vendors and history, so a screen is built and tested against
     data that looks real instead of an empty table. This also removes the biggest
     reason bugs slip through: everything looks fine when there is nothing in it.
110. **Preview environments per change** — every change gets its own throwaway
     deploy with its own seeded database, so it can be seen and tested before it
     touches production. Vercel provides the deploy half for free.
111. **Visual regression tests** — a screenshot of every key screen, compared on
     every build, so a CSS change that quietly breaks a layout three screens away
     is caught in review — the automated version of the sticky-bar and
     text-overflow bugs that were found by eye.
112. **End-to-end tests on the critical paths** — Playwright walking the flows
     that must never break (sign in, record a payment, raise a booking, run the
     repair button), on top of the 239 unit tests that already exist.
113. **A one-command local setup and faster CI** — clone, seed, run, in a minute,
     and a CI pipeline that runs the four checks plus the new ones in parallel and
     fast.
114. **A living component and pattern gallery** — the design-system gallery from
     batch 1, kept current, so the twentieth developer (or the next Claude
     session) builds the right way by copying the right thing.

_Depends on: batches 1 and 18. Free apart from CI minutes, which are minimal at
this scale._

---

## If you want an order

Grouped above by theme. The order I would actually build in:

| Order | Batch | Why there |
|---|---|---|
| 1 | **1 — Design system** | Pays for all eighteen. Every screen after it is cheaper, and it stops the drift now. |
| 2 | **19 — Delivery velocity** (seed data, automate schema registration) | Do it early: seeded data and automated registration make every batch after it faster and safer to build and test. |
| 3 | **2 — Perceived performance** | Highest feel-per-day, no database work, unblocks skeletons everywhere. |
| 4 | **18 — Platform modernisation** | React Compiler, PPR and error boundaries are near-free speed and safety; PPR pairs with batch 2. |
| 5 | **6 — Navigation & IA** | Ninety-six screens need a command palette more than they need anything else. |
| 6 | **7 — Forms & input** | Where the owner spends his day; friction here is felt most. |
| 7 | **3 — Data layer** | Build the query machinery just before feature-batch 24 pours real data in. |
| 8 | **17 — Instant search** | Needs the data layer; then finding a record stops being a scroll. |
| 9 | **5 — Tables at volume** | Immediately after the data layer; the lists are the app. |
| 10 | **16 — Power-user QoL** | Inline editing and shortcuts land best once the tables and palette exist. |
| 11 | **4 — Bundle & assets** | Cheap, broad, and the icon-import fix touches every screen. |
| 12 | **14 — Real-time reactivity** | Once the data layer is fast, make it live; the app starts to feel alive. |
| 13 | **15 — Resilience & offline** | Pairs with real-time; the moment the site team relies on it daily, this matters. |
| 14 | **8 — Dashboards & charts** | Once the numbers are real and the components exist, make them glanceable. |
| 15 | **10 — Dark mode & identity** | The deliberate-looking pass, best after the component set has settled. |
| 16 | **9 — Motion & feedback** | The small moments, once there is a system to apply them to consistently. |
| 17 | **11 — Mobile & field** | High value the moment the site team is on it daily; needs the table-to-card work. |
| 18 | **12 — Accessibility** | Cheapest once forms, motion and components have stopped moving. |
| 19 | **13 — Observability & budgets** | Last, because it guards everything the other eighteen built. |

### What nineteen batches actually means

Two to four days each, so **roughly two to three months of build time**, and
unlike the feature track, almost none of it is gated on anyone else — no lender,
no appeal, no new site. It is the most self-contained work in either plan, which
makes it easy to slot between features whenever the app starts to feel heavy,
stale or inconsistent.

**Past batches 1 and 19, sequencing matters less than it looks.** The design
system has to come first and the delivery machinery close behind; after that, pick
by what is annoying you that week. If the app feels slow, do 2 then 3. If it feels
dead, do 14. If it drops work on site, do 15. If it feels cluttered, do 6 then 10.
If the site team is complaining, do 11.

The nineteen split cleanly into what the user feels (1, 2, 6, 7, 8, 9, 10, 11, 12,
16, 17), how the app behaves under real conditions (3, 4, 5, 14, 15, 13) and the
technology it is built on and shipped with (18, 19). You rarely need to care which
bucket a batch is in — but if a lender, an auditor or a bigger team arrives, the
platform batches (18, 19) and resilience (15) are the ones that stop being
optional.

## Three things I would not do

**A full rewrite in a component framework.** shadcn/Radix-style primitives are
worth adopting *inside* batch 1, but ripping out ninety-six working screens to do
it is a way to spend a month and ship nothing. Adopt the primitives, migrate
screens as you touch them.

**A native mobile app.** The PWA installs and, after batch 11, will feel like an
app. A real app is two more codebases for a team this size — the same conclusion
the feature plan reached.

**Animation for its own sake.** Motion that does not clarify a change is just
latency with a bow on it. Batch 9 is deliberately about feedback and legibility,
not flourish.

## The one thing that beats all of it

The same thing that beats the feature plan: **batch 1**, with **batch 19** right
behind it. Almost every complaint you will have about how the app looks or how
long a new screen takes to build traces back to there being no shared component
set and no seeded data to build against. Do those two first, and the other
seventeen get faster to do and the whole app gets more consistent, more testable
and more alive for free — the interface-and-platform equivalent of the ledger
sitting under the finance batches.
