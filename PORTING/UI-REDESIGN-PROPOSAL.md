# Making Ameya OS feel like an operating system

A proposal, in batches you can accept or reject one at a time. Nothing here is
built yet — I want your call on the direction before I move 120 menu items
around.

---

## The problem, stated plainly

You said the left-hand clutter is hard to work out. Here is what is actually
there:

- **120 navigation items** in **10 groups** in the sidebar
- **a second navigation row** beneath the top bar (9 modules + Customise)
- **a top bar** with project switcher, search, New, alerts, display, theme, avatar
- **a mobile dock**
- **a command palette**

That is **five** navigation systems competing on one screen. The sidebar alone
is longer than most people will ever scroll. Nothing is broken — but a person
opening this for the first time has to *read* rather than *recognise*, and that
is the whole difference in feel you are pointing at.

For comparison: the macOS Finder sidebar shows about 8–12 items. Everything else
on a Mac — thousands of files, hundreds of apps — is reached through Spotlight
(⌘Space) or by drilling in. Apple does not show you everything. It shows you the
few things you use, and makes the rest findable in under a second.

**You already have the Spotlight.** It is ⌘K, and it works. What is missing is
the confidence to hide things behind it.

---

## The four principles I would apply

1. **Recognition over reading.** A short list you scan beats a long list you
   parse. Below roughly a dozen items, the eye recognises; above it, the eye
   reads. Your sidebar is at 120.
2. **The long tail belongs in search.** Anything used less than weekly should be
   findable, not visible. Spotlight, not the Dock.
3. **Things stay where you put them.** The same action should live in the same
   place on every screen. Right now "New" is in the top bar, "Add a lead" is a
   button inside Sales, and the Customise entry is in a third place.
4. **Remove before adding.** Every new item makes the previous 119 slightly
   harder to find. This is the one that is hardest to hold to, and it matters
   the most.

---

## Batch 1 — Cut the sidebar to what people actually use

**The change.** Replace the 10-group, 120-item sidebar with:

```
  Today                    ← what needs you now
  Sales
  Inventory
  Finance
  Site Ops
  Ameya Tally
  Documents
  ─────────────
  PINNED                   ← whatever they pinned (you built this already)
  Tower A Ledger
  Q3 Collections
  ─────────────
  RECENT                   ← last 5 screens, automatic
  ...
  ─────────────
  Browse all ⌘K            ← the other 113 live here
```

Eight fixed entries, plus their own pins and recents. Everything else stays
reachable — through ⌘K, through the Explore Features page you already have, and
through drilling into a section.

**Why this and not just tidier grouping.** Grouping 120 items still leaves 120
items. The gain comes from the *count*, not the arrangement.

**Risk, honestly.** Somebody will look for a screen where it used to be and not
find it. Mitigations: keep the full list one keystroke away, keep Explore
Features as the visible map, and watch which items people search for most in the
first fortnight — anything searched repeatedly has earned a place in the eight.

**Effort:** ~1 day. **Reversible:** entirely — it is a config change.

---

## Batch 2 — Collapse five navigation systems into three

| Today | Proposed |
|---|---|
| Sidebar (120 items) | **Sidebar** — 8 + pins + recents |
| Second nav row (9 modules) | *removed* — it duplicates the sidebar |
| Top bar (7 controls) | **Top bar** — project · search · New · alerts · you |
| Mobile dock | **Mobile dock** — unchanged, it is right |
| Command palette | **⌘K** — promoted to the primary way to reach anything |

The second row exists because the top bar was overcrowded on a 13" screen. With
the sidebar cut down, the modules no longer need a home of their own — they *are*
the sidebar. That gives you back a whole row of vertical space on every page.

**Effort:** ~half a day.

---

## Batch 3 — One page template, applied everywhere

Right now the same heading level renders four different ways across the app
(I counted). Fix the template once and every screen inherits it:

```
┌─────────────────────────────────────────────┐
│  Breadcrumb                                 │   ← where am I
│  Page title            [primary action]     │   ← one obvious action
│  One line of context                        │
├─────────────────────────────────────────────┤
│  Content, max ~1100px, centred              │   ← comfortable line length
└─────────────────────────────────────────────┘
```

Two specifics worth calling out:

- **One primary action per page**, top right, always the same place. Secondary
  actions go in a `⋯` menu. At the moment some pages have four buttons of equal
  weight, which means none of them is the answer to "what do I do here".
- **Cap the content width.** Full-width text on a 27" monitor is unreadable —
  the eye loses the line. A capped, centred column is why every well-made
  document app does this.

**Effort:** ~1 day, mostly mechanical.

---

## Batch 4 — Make the empty states do some work

Your dashboard currently reads: `0 · 0 · 0% · 0% · 0`. Technically correct, and
completely useless to somebody deciding what to do next.

An empty state should say what it is, why it is empty, and what to do:

> **No leads yet**
> Leads arrive from your website, the portals and walk-ins.
> **[Add one by hand]** · **[Connect a portal]**

This is the single highest-return visual change on the list, because right now
the first thing a new user sees is a wall of zeros.

**Effort:** ~1 day for the dozen screens people hit first.

---

## Batch 5 — The details that make it feel considered

Small, individually trivial, collectively the entire difference:

- **Consistent spacing.** Pick 4/8/16/24/32 and use nothing else. Mixed spacing
  is the main reason an interface feels "off" without anyone being able to say why.
- **Fewer weights and sizes.** Three text sizes and two weights for 90% of the UI.
- **Motion with a purpose.** 150–200ms on things that change state; nothing on
  things that just appear. Animation that decorates gets tiring by the third day.
- **One accent colour.** Your brass/navy is distinctive — use it for *the* action
  on a page and nothing else. An accent used everywhere stops being an accent.
- **Keyboard parity.** ⌘K search, ⌘N new, `/` focus search, `Esc` close, `g` then
  a letter to jump. Your Tally screen already has this discipline; the rest of
  the app does not.

**Effort:** ~2 days, and the least risky work on this list.

---

## What I would do, if it were mine

**Batch 1 and 4 first.** The sidebar cut is the thing you actually complained
about, and the empty states are what a new user meets first. Together that is
about two days and would change the impression of the product more than the
other three combined.

**Batch 3 next**, because every screen you add afterwards inherits it — the
longer it waits, the more screens have to be retrofitted.

**Batch 2 and 5 last.** Real improvements, but nobody has ever abandoned a CRM
over inconsistent spacing.

---

## What I need from you

1. **Which eight items belong in the sidebar?** My guess is Today, Sales,
   Inventory, Finance, Site Ops, Ameya Tally, Documents, Admin — but you know
   what your team opens every morning and I am inferring it.
2. **Is anyone using the second nav row?** If your team has started relying on
   it, Batch 2 changes shape.
3. **How much churn can your team absorb?** If people are mid-onboarding, moving
   navigation now costs more than it gains — better to do it before they build
   habits, or well after.

Say which batches you want and I will build them one at a time, so you can see
each land before committing to the next.
