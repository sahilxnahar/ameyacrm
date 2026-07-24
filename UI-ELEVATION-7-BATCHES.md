# Ameya Heights CRM — visual & experience elevation (7 batches)

**The aim:** make the whole interface *beautiful, interesting, appealing, and
effortless* — a premium real-estate product people enjoy opening, not just one
they can operate. The earlier UX work (batches 1–16) made the app usable,
findable and forgiving. This is the layer on top: look, feel, life and delight.

Grounded in what's already here — the gold-accent brand (`gold-shine` /
`gold-solid`), the Cormorant Garamond display + Inter body + Unbounded accent
fonts, dark mode, reduced-motion support, recharts, the `StatTile` / `Card` /
`EmptyState` design-system components, and skeletons — so these **refine and
elevate** a real foundation rather than restyle from scratch.

Ordered so each batch makes the next look better.

---

## Batch V1 — A premium visual language
**The aim.** Everything should look considered and high-end the moment it loads.
Today the pieces are consistent but plain; this gives them a refined, branded feel.

**What we do.**
- Tighten the **design tokens**: a richer colour system around the gold accent,
  a clear typographic scale (display vs body vs accent, sizes, weights, line
  heights), a spacing rhythm, corner-radius and **elevation/shadow** system.
- Refine the core components — cards, buttons, inputs, badges, tables — to a
  premium standard, with proper light/dark treatments.
- A subtle texture / depth language (soft surfaces, considered borders) so the
  app reads as a crafted product, not a form.

**Why it lands.** It sets the tone for the whole thing in one move — every screen
inherits it.

---

## Batch V2 — Motion & micro-interactions
**The aim.** Make it feel alive and responsive — the difference between a page and
an *app*.

**What we do.**
- Purposeful **transitions**: pages and sections ease in, panels and drawers
  slide, lists animate on add/remove/reorder.
- **Micro-feedback** on every interaction: buttons press, toggles spring, hovers
  lift, saves confirm with a satisfying tick.
- **Choreographed loading** (staggered skeletons, gentle shimmer) and small
  flourishes like number count-ups on KPIs.
- All of it honours the **reduced-motion** setting already in place — delight
  without motion sickness.

**Why it lands.** Tasteful motion is what makes software feel premium and alive.

---

## Batch V3 — Beautiful data & dashboards
**The aim.** Turn tables of numbers into visuals that invite attention — the app
should look insightful at a glance.

**What we do.**
- **KPI tiles with life**: sparklines, trend arrows, tiny bars, so a number tells
  a story.
- **Progress rings**, funnel/pipeline visuals, collection gauges, occupancy bars.
- A consistent, branded **chart style** (colours, grids, tooltips) across every
  chart, so analytics feels like one product.
- An **executive at-a-glance** treatment for the home and reports — the "wow" view.

**Why it lands.** For owners and managers, this is the screen that sells the whole
system.

---

## Batch V4 — A visual, image-rich product
**The aim.** Real estate is visual. The CRM should lean into imagery instead of
reading like a spreadsheet.

**What we do.**
- **Inventory & unit cards with photos and floor plans**, project **cover
  imagery**, a gallery view of the development.
- A visual **pipeline / kanban board** for leads and bookings — drag cards through
  stages.
- **Avatars** everywhere (people, buyers, partners), image thumbnails on documents
  and site photos, richer buyer and project profiles.
- Graceful image handling — tasteful placeholders, lazy loading, the right sizes.

**Why it lands.** It makes the product feel rich and real, and matches how buyers
and sellers actually think — in pictures.

---

## Batch V5 — Personality, illustration & moments of delight
**The aim.** Give the app warmth and a memorable character, and reward people for
using it well.

**What we do.**
- Custom, on-brand **illustrations** for empty, success and error states (no more
  bare "nothing here").
- A consistent, human **voice** across microcopy — encouraging, clear, a little
  charming.
- **Moments of delight**: a gentle celebration when a booking is won, a target is
  hit, or onboarding is finished — small, tasteful, opt-out-able.
- A light **brand personality** thread (a mark, a signature accent) so it feels
  like *Ameya Heights*, not generic software.

**Why it lands.** Personality is what makes people *like* using something, and
recommend it internally.

---

## Batch V6 — Personalisation & themes
**The aim.** Let each person make the space feel like theirs — comfort drives daily
use.

**What we do.**
- **Theme & accent options** (beyond light/dark), remembered per person, on top of
  the text-size/density controls already shipped.
- A **customisable home / dashboard** — pick and arrange the cards that matter to
  you.
- Saved layouts and views, a personal "start screen" per role.
- Optional **cover/brand imagery** for the workspace so the app wears the company.

**Why it lands.** Personalised software feels like *yours* — people settle in and
stay.

---

## Batch V7 — The cohesive polish pass
**The aim.** Make the whole thing feel like one finished, premium product — no
screen left looking half-done.

**What we do.**
- A **screen-by-screen sweep** applying the new language everywhere: every state
  (hover, active, focus, loading, disabled, empty, error) designed, not default.
- Align spacing, headers, tables and forms to the system; consistent icons and
  wording; remove the last rough edges.
- A final pass on **responsiveness and large-screen richness** so it's gorgeous on
  a phone and a 27-inch monitor alike.

**Why it lands.** Consistency is the difference between "nice screens" and "a
beautiful product". This is what ties it all together.

---

## How to sequence & what it needs
- **V1 first, V7 last.** V1 sets the language every other batch uses; V7 is the
  consistency sweep that locks it in. In between, V2 (life) → V3 (data beauty) →
  V4 (imagery) → V5 (personality) → V6 (personalisation).
- **Mostly code, some assets.** Almost all of this is buildable in code. Two things
  benefit from real assets: photography/floor-plans (V4 — your own images) and
  custom illustrations (V5 — can start with tasteful built-in art and upgrade
  later).
- **Quality bar, as always:** each ships as its own green version — 0 type errors,
  all tests, all verifier checks, production build clean. Most need little or no
  schema change (V6 may add a small preferences table).
