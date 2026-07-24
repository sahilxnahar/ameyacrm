# Ameya Heights CRM — interface simplification (8 batches)

Your goal: make the whole thing **calmer, roomier, and easier for anyone to
use** — less clutter, more space, bigger readable text, a proper Compact ⇄
Comfortable switch that's easy to reach, and a sensible re-order of what shows
first on each screen.

Two honest starting points, so this plan is grounded in what's really there:

- You **already have** a density control (Comfortable / Compact), text-size, accent
  colour and language — but it's tucked behind the slider icon in the top bar,
  and "Comfortable" barely changes anything (today it only tightens table rows).
  So the switch exists; it needs to be *made real* and *made obvious*.
- The recent visual refresh (v14.43 — softer cards, deeper dark mode, KPI tiles)
  is the first coat of paint. This plan is the layout-and-clutter half.

Ordered by how much they change the everyday feel.

---

## Batch U1 — A real, one-tap Comfortable ⇄ Compact switch
**The aim — your "easy for anyone to access" ask.** Right now the density choice
is hidden and shallow. Make it a visible, one-tap control that genuinely changes
the whole app.

**What we do.**
- Add a **third, roomier "Spacious"** option alongside Comfortable and Compact
  (like Gmail's three densities), and put the switch somewhere obvious — a labelled
  control, not just an icon.
- Make density **mean something everywhere**: page padding, the gap between
  sections, card padding, row height, and list spacing all respond — so
  "Spacious" truly opens up and "Compact" fits more on screen.
- Remember the choice per person, applied instantly (no reload).

**Why it lands.** One switch, and the entire app breathes the way each person wants.

---

## Batch U2 — Breathing room & open, readable text
**The aim — "a lot of spacing and a lot of open text".** Set a calmer default
rhythm so nothing feels cramped, even before anyone touches the density switch.

**What we do.**
- More generous default whitespace: page margins, space between cards and
  sections, and inside cards.
- Bigger, more readable body text and headings by default, with comfortable
  line-height, and a cap on line length so paragraphs don't stretch across a wide
  monitor.
- A consistent vertical rhythm, so every screen feels like the same, tidy system.

**Why it lands.** Space and legible type are what make software feel effortless.

---

## Batch U3 — Declutter every screen (show less, reveal on demand)
**The aim — "it is very cluttered, and there is a lot of information".** Put the
few things that matter up front and tuck the rest away until it's wanted.

**What we do.**
- Trim busy tables to the **columns that matter**; the rest move onto the record's
  own page.
- Reduce long KPI rows to the **vital few** numbers; the deeper metrics get a
  "more" view.
- Move secondary detail behind **"Show more", tabs, or expandable sections**, so a
  screen opens calm and you dig in only when you need to.
- Let white space exist — stop filling every corner.

**Why it lands.** Less on screen at once is the single biggest "this feels simpler".

---

## Batch U4 — Re-order content & sharpen the hierarchy
**The aim — "change the entire content order".** On each screen, lead with the
one thing that matters, then the next, in a predictable shape.

**What we do.**
- A consistent page skeleton everywhere: **title → the key number(s) → the main
  list or action → secondary detail** — top-left is always the most important thing.
- **One clear primary action** per screen (a single obvious button), with the rest
  demoted to quieter secondary actions.
- Group related information together and separate the unrelated, with clear,
  plain-language section headings.

**Why it lands.** When every screen is laid out the same way, people stop hunting.

---

## Batch U5 — A leaner menu (fewer choices at once)
**The aim.** The menu is long. Show the everyday few by default and keep the rest
one tap away — building on the collapsible rail and pinning you already have.

**What we do.**
- Default the menu to the **common screens**, with an **"More / All features"**
  expander for the long tail (the Explore Features map already backs this).
- Sensible defaults for a first-time user, still fully customisable per person.
- Tighten group names to plain words.

**Why it lands.** A short menu is a calm menu; power is still there, just not shouting.

---

## Batch U6 — Quieter visuals (less colour noise)
**The aim.** Reduce the number of competing colours, badges and bold bits so the
eye rests on what matters.

**What we do.**
- One consistent, quiet colour per status (and fewer of them on screen at once).
- Lighter, more uniform borders and card treatment (extends v14.43).
- Use bold and accent colour sparingly — for the one thing that needs attention,
  not everywhere.

**Why it lands.** Calm visuals make a dense product feel simple without removing anything.

---

## Batch U7 — Phone-first simplicity
**The aim.** Make the simplified layouts shine on a phone, where site staff live.

**What we do.**
- Single-column, essential-first layouts on small screens; big tap targets.
- The roomy spacing and readable text carry to mobile.
- The most common actions reachable with one thumb.

**Why it lands.** Most of your team is on a phone — simple has to mean simple there too.

---

## Batch U8 — Optional "Simple mode" for everyone else
**The aim.** A one-switch, pared-back version of the CRM for people who only need
the basics — big text, roomy spacing, and just the handful of screens they use.

**What we do.**
- A **Simple mode** toggle: hides advanced areas, enlarges text, maximises spacing,
  and shows only the common tasks — turn it off any time to get the full CRM back.
- Great for site staff, new joiners, and anyone who finds the full app busy.

**Why it lands.** The same software can feel expert *or* effortless, per person.

---

## Batch U9 — Gentle guidance instead of a manual
**The aim.** Nobody should need training. Teach the screen, on the screen, only
when it helps.

**What we do.**
- A short, skippable **first-run walkthrough** that points out the few things a
  new person needs, then gets out of the way.
- Small **"what's this?"** helpers next to anything technical, in plain words.
- **Empty screens that teach** — every blank list says what belongs there and how
  to add the first one (extending what some screens already do).
- A quiet **"Need a hand?"** entry that opens the relevant help, not a generic page.

**Why it lands.** Confidence on day one is what makes people actually use it.

---

## Batch U10 — Make it yours (saved views & a home that fits)
**The aim.** Different roles need different things first. Let each person shape
their own starting point without touching anyone else's.

**What we do.**
- **Saved views**: filter a list the way you like — "my overdue payments",
  "this week's site visits" — name it, and it's one tap next time.
- **Choose your landing screen**, so the app opens on what *you* do first.
- **Favourites / recents** surfaced so the things you touch daily are always close.
- Sensible defaults per role, all overridable per person.

**Why it lands.** A tool that opens on your work feels made for you.

---

## Batch U11 — Find anything in two seconds
**The aim.** Never hunt through menus. Type what you want and go.

**What we do.**
- A stronger **command bar** (the ⌘K search): jump to any screen, any record, or
  run a quick action (new lead, log a payment) from anywhere, in plain words.
- **Recents** and **suggested next steps** right in the search, so common jumps
  are already there.
- Search that understands everyday language, not just exact names.

**Why it lands.** When finding is instant, the size of the app stops mattering.

---

## Batch U12 — Effortless forms & data entry
**The aim.** Typing things in is where people feel friction most. Make every form
short, forgiving, and fast.

**What we do.**
- **Single-column, one-thing-at-a-time** forms; long ones broken into gentle steps.
- **Smart defaults** and remembered values, so fields fill themselves where they can.
- **Inline, friendly validation** (fix it as you go, no scary red walls at the end)
  and **autosave** on longer forms so nothing is ever lost.
- Hide rarely-used fields behind "more options" — show the few that matter.

**Why it lands.** Less typing, fewer mistakes — the part everyone does all day gets easy.

---

## Batch U13 — One consistent kit (so everything behaves the same)
**The aim.** Reduce the mental load: a button, a table, a menu, a pop-up should
look and act identically on every screen.

**What we do.**
- Unify the building blocks — buttons, inputs, tables, tabs, pop-ups, filters —
  into **one consistent set**, so once you learn one screen you know them all.
- The same **sorting, filtering and multi-select** behaviour on every list.
- One way to confirm, one way to cancel, one way to go back — everywhere.

**Why it lands.** Consistency is invisible, but it's the biggest reason software
feels "easy" or "hard".

---

## Batch U14 — Responsive, alive, and reassuring
**The aim.** Make the app feel quick and trustworthy — it always tells you what's
happening.

**What we do.**
- **Loading skeletons** on every screen (so nothing flashes blank), building on
  the ones just added.
- **Instant feedback**: actions respond immediately (optimistic updates), with a
  clear, calm success or "here's what went wrong" message.
- **Gentle motion** — panels and pages ease in, nothing jumps — kept subtle and
  respectful of reduced-motion settings.

**Why it lands.** An app that feels responsive feels simple, even when it's doing a lot.

---

## How to sequence
- **U1 + U2 first** — the density switch made real, plus roomier defaults. You'll
  *feel* the whole app open up immediately, and it's low-risk (spacing and a
  control, no data changes).
- Then **U3 → U4** to declutter and re-order the screens that matter most (we'll
  pick the top 6–8 screens together and do them in passes).
- Then **U5 → U6 → U7** to calm the menu, the colour, and the phone experience.
- Then **U11 → U12 → U13** — find-anything search, effortless forms, and one
  consistent kit — the everyday-friction wins.
- Then **U9 → U10 → U14** — gentle guidance, make-it-yours, and responsive polish.
- **U8 (Simple mode)** whenever you want the big, optional win.
- **Quality bar, as always:** each ships as its own green version — 0 type errors,
  all tests, all checks, production build clean. None of this changes your data.

Tell me which to start with — my suggestion is **U1 + U2 together** so you see and
feel the difference straight away, then we pick the screens for U3/U4.
