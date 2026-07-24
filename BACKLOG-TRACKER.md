# Ameya Heights CRM — backlog from 23 Jul review

Everything from your walkthrough, captured and grouped so we work through it
cleanly. Each item ships as its own green version (0 errors, tests, clean build).
Ordered so the **bugs you're hitting daily** get fixed first, then the everyday
improvements, then the bigger new tools.

---

## A. Bugs — fix first (things that are broken right now)

1. **CSV import error on Billing.** The "Import bill with AI" showed
   `openrouter.ai refused it (HTTP 401 — User not found)`. That's the AI key,
   not the CSV — the OpenRouter key is invalid/expired. Two parts: (a) fix/replace
   the AI key so AI bill-reading works, and (b) that AI importer is for *scanned
   bills*, not spreadsheets — for a CSV/Excel of payments use Money → Vendor
   Ledgers → Import (now Excel-enabled). I'll also make the error clearer.
2. **Map won't load** ("The map library could not load"). The map tiles/library
   aren't loading on your network. Needs investigation (likely the map library
   CDN blocked, or an offline cache issue).
3. **"Mark complete" still emails you that work is due.** A completed task/work
   item is still triggering the reminder/overdue emails. Bug in the reminder
   filter — must exclude completed items.
4. **Check-in distance wrong.** It reads "2.0 km away" when you're 7 km away, and
   the Check-in button doesn't work. The distance calc / geolocation is off.
5. **Can't set a profile photo / avatar.** Uploading an avatar isn't saving.
6. **Today's Priorities not synced** to actual pending work across the CRM — it
   should reflect everything genuinely open/overdue, everywhere.
7. **Logo wordmark blurred/washed in light mode** (fine in dark). → fixing this
   one now, this turn.

## B. Everyday improvements

8. **Drag-and-drop on every import** (not just click-to-choose) — payments,
   leads, treasury, documents, everywhere there's an upload.
9. **Commission type for channel partners.** Not always a %: a commercial lease
   is "1–2 months' rent + GST", a sale is a %. Add a **dropdown**: % of sale /
   months of rent / flat fee, with the right inputs for each.
10. **Profile fields** — add WhatsApp number and phone, and let you edit/customise
    the profile properly.
11. **Messages + AI everywhere.** Small **Messages** and **Assistant** buttons in
    the top bar (always reachable, no scrolling), a slightly **bigger top nav**,
    and **show the person's role** so they know what they can do.

## C. New tools / features

12. **PDF & document converter (no AI tokens).** A tools page like iLovePDF /
    SmallPDF: convert PDF ⇄ Word/Excel/CSV/Markdown/images, merge, split,
    compress, etc. — done with libraries, **zero AI tokens**. (Some conversions
    are easy server-side; a few, like PDF→editable Word, are harder — I'll list
    exactly what's realistic.)
13. **Marketing asset library.** A place for each project's assets — **logo,
    banner, brochure, website link, social handles, rendered images**, and a
    **Google Drive link** — as clear columns/cards so anyone can click, download
    and share. This also answers "how do I segregate my 8–9 GB" (see note below).
14. **AI Assistant + documents.** Upload a document to the assistant, or a button
    to browse/filter the CRM's documents and ask questions about them.
15. **Map upgrades.** Once the map loads: pin **AMEYA 494 / 494 by Ameya**, and a
    **nearby filter** (hospitals, public transport, schools…) at one click.

## D. Questions — answered in chat (no build needed)

16. **Google Workspace single sign-on** — how, and does DNS matter. (Answered.)
17. **Segregating 8–9 GB of assets** — how to structure it. (Answered — ties to #13.)

---

## Suggested order

1. Quick bug fixes: logo (now) → task-complete emails → check-in distance →
   avatar/profile photo → Today's Priorities sync → map loading.
2. Everyday: drag-and-drop everywhere → commission dropdown → profile fields →
   top-bar Messages/Assistant + role.
3. New tools: Marketing asset library → PDF/doc converter → AI-with-documents →
   map pins & nearby filters.

Tell me if you want to re-prioritise; otherwise I'll work top-down.
