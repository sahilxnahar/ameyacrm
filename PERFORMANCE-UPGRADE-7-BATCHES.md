# Ameya Heights CRM — performance upgrade roadmap (7 batches)

Seven batches covering **every** performance lever for this app: the database, how
we cache and render, what crosses the wire, the JavaScript bundle, how fast it
*feels*, assets, and the monitoring that keeps it fast. Grounded in what already
exists — Web Vitals tracking, an `/admin/performance` page, `/admin/errors`,
pooled Neon Postgres, React `cache()`, `next/font`, the offline outbox, some
loading skeletons — so each batch goes deeper or fills a real gap rather than
redoing what's there.

Ordered by real-world impact for a data-heavy CRM. One principle up front:
**measure before you optimise.** Batch 7 (monitoring) is listed last by impact,
but stand up a slice of it *first* so every other batch targets the pages that are
actually slow, not the ones we guess are.

---

## Batch P1 — Database & query performance
**Why first.** In a CRM with 171 tables, the database is almost always the real
cost. One missing index or an N+1 query does more damage than any amount of
front-end tuning.

**What we do.**
- **Index audit** — add indexes on foreign keys and on the columns we filter and
  sort by most (status, dates, ownerId, projectId), plus composite indexes for the
  common "where + order by" pairs. Drop unused ones.
- **Kill N+1s** — find places that query in a loop and fold them into one
  `include`/`select`; use `groupBy`/aggregates instead of counting in code.
- **Bound every query** — several reads currently pull up to 20,000–50,000 rows;
  replace those with pagination and sensible caps so one big account can't stall a
  page.
- **Statement timeouts & pooling** — confirm the pooled Neon URL is used
  everywhere, set query timeouts so a slow query fails fast instead of hanging.
- **Slow-query logging** — record queries over a threshold so we can see the worst
  offenders instead of guessing.

**Effort/impact.** Medium effort, the **highest** impact of all seven.

---

## Batch P2 — Caching & rendering strategy
**The problem.** Many pages are `force-dynamic`, which means every visit rebuilds
everything from the database — even data that changes a few times a day. That is
the single biggest source of avoidable server work.

**What we do.**
- **Cache what rarely changes** — wrap expensive reads (dashboards, reports,
  reference lists) in Next's data cache with a sensible `revalidate`, and
  **invalidate on write** with cache tags so the numbers are never stale.
- **Static where possible / ISR** — turn pages that don't need per-request data
  into cached or incrementally-revalidated pages.
- **Partial Prerendering (PPR)** — serve an instant static shell (the layout,
  headers, skeletons) while the dynamic parts stream in — a Next 15 feature this
  app is well placed to use.
- **HTTP & CDN caching** — long-cache static assets, proper cache headers on API
  responses that can tolerate it.

**Effort/impact.** Medium effort, very high impact — often the difference between a
page that "loads" and one that "appears".

---

## Batch P3 — Payloads & lists at scale
**The problem.** Speed is also about how much data crosses the wire and how much
the browser must then render. Big lists and over-fetched objects make even a fast
query feel slow.

**What we do.**
- **Fetch only what's shown** — tighten `select`s so we stop shipping columns the
  screen never uses (and keep Decimals converted to numbers before the client).
- **Cursor pagination / infinite scroll** on every large list, instead of loading
  everything at once.
- **Virtualised tables** — render only the rows on screen for the long registers,
  so 5,000 rows scroll as smoothly as 50.
- **Server-side filter, sort and search** — do the work in the database, send back
  a page, not the whole table to filter in the browser.
- **Response compression** for large JSON.

**Effort/impact.** Medium effort, high impact on the heaviest screens.

---

## Batch P4 — Frontend bundle & code splitting
**The problem.** Every screen pays to download and parse the JavaScript it pulls
in. Heavy libraries (charts, the command palette, rich editors) loaded eagerly
slow the first paint of pages that may not even use them.

**What we do.**
- **Analyse the bundle** to see what is actually large.
- **Dynamic-import heavy pieces** (charts, palette, editors, maps) so they load
  only when needed, off the critical path.
- **Trim client components** — move logic to server components where it doesn't
  need the browser, shrinking the JS shipped.
- **Tree-shake** icon and utility imports so we ship only what we use.
- **Split by route** so a heavy admin screen never weighs down a light one.

**Effort/impact.** Medium effort, high impact on first-load and low-end phones.

---

## Batch P5 — Perceived speed & instant navigation
**The problem.** A lot of "slow" is really *waiting with no feedback*. The app can
feel instant even while work happens in the background — if we design for it.

**What we do.**
- **Optimistic UI** on the common actions (tick a task, save a field) — the screen
  updates immediately and reconciles when the server confirms.
- **Prefetch** the likely next pages on hover/viewport so navigation is instant.
- **Streaming + Suspense** with a skeleton for every slow section, and a
  `loading.tsx` on every route, so nothing ever shows a blank screen.
- **Kill layout shift (CLS)** — reserve space for images, charts and async content
  so the page doesn't jump as it loads.

**Effort/impact.** Low–medium effort, very high *felt* impact — this is the batch
users notice most. (Builds on the nav progress bar and skeletons already present.)

---

## Batch P6 — Assets, images, fonts & PWA caching
**The problem.** Images and fonts are often the largest bytes on a page, and a CRM
installed as an app should reopen instantly from cache.

**What we do.**
- **`next/image` everywhere** — correct sizing, lazy loading, modern formats
  (AVIF/WebP) so avatars, site photos and logos are a fraction of the weight.
- **Font tuning** — subset, preload and `display: swap` (on top of the `next/font`
  setup already in place) so text never blocks or flashes.
- **Service-worker app-shell caching** — the shell and static assets load from the
  device on repeat visits (extending the offline outbox already built), so the app
  reopens instantly and survives a flaky signal.
- **Long-cache + compress** all static assets.

**Effort/impact.** Low–medium effort, high impact on repeat visits and on site
staff uploading photos over mobile data.

---

## Batch P7 — Monitoring, budgets & load testing
**Why it matters (and why to start a slice of it first).** You can't keep what you
can't see. This turns performance from a one-off cleanup into something that stays
fast — and tells the other six batches where to aim.

**What we do.**
- **Real-user monitoring** — capture the Web Vitals already being measured into a
  small store and a dashboard, so we see real page speed on real devices, per
  screen, over time.
- **Slow-route & slow-query alerts** — surface the worst pages and queries
  automatically (extending `/admin/performance` and `/admin/errors`).
- **Performance budgets in CI** — fail the build if the bundle or a key metric
  regresses, so speed doesn't quietly erode release by release.
- **Load / stress testing** — simulate many concurrent users to find the breaking
  point before your customers do, and confirm the connection pool holds.

**Effort/impact.** Medium effort; compounding impact — it protects every gain the
other batches make.

---

## How to sequence
- **Measure first.** Stand up the RUM slice of **P7** and the slow-query log from
  **P1** before optimising, so you fix the pages that are actually slow.
- **Then biggest levers:** **P1 → P2 → P3** (database, caching, payloads) are where
  the real server time lives.
- **Then felt speed:** **P5 → P4** make it *feel* instant.
- **Then polish & protect:** **P6**, and the rest of **P7** to lock the gains in.
- **Quality bar, as always:** 0 type errors, all tests, all verifier checks,
  production build clean — each shipped as its own version, with any SQL and the
  zip delivered separately. Most of these need no schema change; only P1 (indexes)
  and parts of P7 (a metrics table) touch the database, and those migrations are
  small and idempotent.
