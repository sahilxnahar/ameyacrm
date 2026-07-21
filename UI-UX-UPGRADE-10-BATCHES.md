# Ameya Heights CRM — UX/UI upgrade roadmap (10 batches)

**Goal:** make the whole application so clear and convenient that a layman — a new
sales trainee, a site supervisor, an owner who opens it twice a week — can use it
effectively without training. Every batch below is user-experience only: no new
business features, just making the ones we have obvious, friendly and fast.

The batches are ordered by impact for a first-time user. Each can ship on its own
and be deployed independently, exactly like the feature batches.

---

## Batch 1 — Navigation & findability
**The problem.** The "Business" menu alone has ~40 items in one long list. A new
user cannot find "how do I add a lead" without scrolling past "Drawing Transmittals"
and "Commercial Leasing". The sidebar is a filing cabinet, not a guide.

**What we build.**
- Regroup the whole menu into a handful of plain, task-shaped sections ("Sell",
  "Money", "Build", "Land & legal", "Run the office", "Admin") instead of one
  giant "Business" bucket.
- Collapsible groups that remember what you opened; the sections you never use
  stay shut.
- **Pin / favourites** — star the 5–6 screens you actually use; they float to the
  top in a "Your shortcuts" strip.
- A **"Recent"** row so you can jump back to where you just were.
- Role-aware defaults: a salesperson opens to a short, sales-only menu; the full
  tree is one click away for those who want it.

**Layman payoff.** The first thing they see is short and relevant, not a wall of
forty options.

---

## Batch 2 — Plain language & in-context help
**The problem.** The app speaks real-estate-finance: "three-way match", "GRN",
"RERA escrow", "covenants", "transmittals", "feasibility appraisal". A layman has
no idea what these do or whether they need them.

**What we build.**
- A **microcopy pass** over every menu label, page title and button: keep the
  correct term but add a plain subtitle ("Three-way match — check that bills match
  the order and what actually arrived").
- A small **"?" tooltip** next to jargon that explains it in one sentence.
- A searchable **glossary** page ("What does X mean here?").
- Friendlier button and empty-state wording throughout ("Add your first lead"
  instead of "No records").

**Layman payoff.** They understand what a screen is for before they click it, and
never feel stupid for not knowing a term.

---

## Batch 3 — Guided onboarding & first run
**The problem.** A brand-new user lands on a blank, powerful app with no idea where
to start. Empty screens teach nothing.

**What we build.**
- A short **welcome wizard**: who are you (sales / finance / site / owner), what
  do you want to do first — then it drops you on the right screen.
- A **getting-started checklist** ("add a project", "invite your team", "log your
  first lead") that ticks itself off as they go.
- **Teaching empty states**: every empty screen shows one example row and a single
  clear "add" button, so the first action is obvious.
- Optional **sample data** they can load to explore safely, then clear.

**Layman payoff.** The app holds their hand for the first ten minutes instead of
leaving them to guess.

---

## Batch 4 — The "Home" launchpad
**The problem.** To do anything, a user has to know which of 100+ screens to open.
There's no single "what needs me right now" view for a casual user.

**What we build.**
- A redesigned **Home** screen that answers three questions at a glance: *what's
  waiting on me* (approvals, overdue tasks, follow-ups due today), *what's new*,
  and *what do I want to do* (big quick-action buttons: New lead, Record payment,
  Add task, Book a unit).
- Action **cards with a next step**, not just numbers — "3 payments awaiting your
  UTR → enter them".
- Personalised to the user's role and permissions so it never shows things they
  can't act on.

**Layman payoff.** They can live on one screen and be nudged to the right place,
instead of navigating.

---

## Batch 5 — Guided flows & smart forms
**The problem.** The add/edit forms are dense — many fields at once, some jargon,
easy to fill wrong. A layman stalls on a 20-field form.

**What we build.**
- Turn the common jobs (add a lead, record a payment, book a unit, raise a
  request) into **step-by-step wizards** — 3–4 short steps instead of one big form.
- **Progressive disclosure**: show the 4 fields that matter, tuck the rest under
  "More details".
- **Smart defaults** (today's date, the active project, the logical status) so most
  fields are pre-filled correctly.
- **Input helpers**: phone/amount/date masks, a rupee formatter, pickers instead of
  free text where possible.
- **Inline, friendly validation** as they type ("This looks like a mobile number —
  add the last digit") and a **duplicate warning** before they create a second copy
  of the same lead.
- **Autosave / draft** so a half-finished form isn't lost.

**Layman payoff.** Filling things in feels guided and forgiving, not like a tax
form.

---

## Batch 6 — Search & ask in plain English
**The problem.** Finding a specific lead, payment or document still means knowing
which screen and which filter. The command palette exists but expects you to know
what to type.

**What we build.**
- Upgrade global search so it understands **plain-English asks** — "overdue
  payments", "leads from last week", "Sharma's booking" — and returns real answers
  and jump-links, not just page names.
- **Synonyms** so "bill", "invoice" and "voucher" all find the right thing.
- Search **across everything** (leads, bookings, documents, people, tasks) from one
  box, grouped by type.
- Recent and suggested searches so the box is useful before you type.

**Layman payoff.** They ask for what they want in their own words and get taken
straight there.

---

## Batch 7 — Visual clarity & consistency
**The problem.** Screens have drifted — different table styles, status colours and
spacing. Dense tables are hard to scan. Nothing is *wrong*, but it isn't calm or
uniform, which makes a newcomer work harder.

**What we build.**
- A tightened **design system pass**: one type scale, consistent spacing, one
  status-colour language (green = good, amber = attention, red = problem) used
  identically everywhere.
- **Readable tables**: sticky headers, clear sortable columns, better number
  alignment, zebra rows, and a **card view on narrow screens**.
- A **comfortable / compact density** toggle for people who want more or less on
  screen.
- Consistent icons, buttons and badges from a single set.
- Polished **loading skeletons** so screens never flash blank.

**Layman payoff.** Every screen looks and behaves the same way, so learning one
teaches them all.

---

## Batch 8 — Mobile & field-first experience
**The problem.** Site staff and salespeople are on phones, often one-handed, often
with poor signal — but many screens are laid out for a desktop.

**What we build.**
- A proper **mobile layout**: bottom navigation for the top actions, big tap
  targets, thumb-reachable buttons.
- **Camera-first capture** for site photos, documents and expense bills — one tap
  to shoot and attach.
- Mobile-optimised versions of the common forms (the wizards from Batch 5,
  reflowed for a phone).
- Stronger **offline resilience**: capture now, sync when signal returns, with a
  clear "waiting to send" indicator (builds on the existing outbox).

**Layman payoff.** The people in the field can actually use it on the device they
have in their hand.

---

## Batch 9 — Feedback, error recovery & trust
**The problem.** When something goes wrong the app can show technical messages, and
there's limited "are you sure / undo". A layman fears breaking something.

**What we build.**
- **Plain, kind error messages** with a next step ("We couldn't save that because
  the amount was blank — add an amount and try again"), never a stack trace.
- **Undo** on destructive actions (delete, cancel) with a short "Undone?" window.
- Clear **confirm dialogs** only where they matter, and **progress feedback** on
  anything slow ("Saving… / Sent").
- Consistent **success toasts** so the user always knows an action worked.
- A gentle, friendly version of the "database is behind" and permission messages.

**Layman payoff.** They trust that they can't easily break things, and always know
what just happened.

---

## Batch 10 — Accessibility & personalisation
**The problem.** Not everyone reads small English text or uses a mouse. And people
work differently — some want dark mode, some want their own saved views.

**What we build.**
- **Accessibility to WCAG AA**: full keyboard navigation, screen-reader labels,
  visible focus, colour contrast that passes, and honouring reduced-motion.
- **Font-size / larger-text control** and a **high-contrast** option.
- **Dark / light theme** and remembered preference.
- **Saved views & remembered filters** per user, so the report or list they use
  every day opens the way they left it.
- Optional **regional-language labels** for the core screens, so a non-English-first
  user can navigate comfortably (full localisation is the separate feature Batch 31;
  this is the UI-label layer).

**Layman payoff.** The app adapts to the person — their eyes, their hands, their
language, their habits — instead of the other way round.

---

## How these map to the app today
- Several foundations already exist and these batches build on them rather than
  redo them: the command palette and global search (Batch 6), the design-system
  components in `src/components/ui` (Batch 7), the offline outbox and mobile nav
  (Batch 8), loading/skeleton and error boundaries (Batch 9), reduced-motion CSS
  and `next/font` (Batch 10).
- Suggested order to feel the difference fastest: **1 → 4 → 2 → 5**, then the rest.
  Navigation and the Home launchpad change the everyday experience most; plain
  language and guided forms remove the next biggest barriers.
- Each batch ships to the same quality bar as the feature work: 0 type errors, all
  tests, all verifier checks, production build clean — and is delivered as its own
  version with any SQL and the zip separately.
