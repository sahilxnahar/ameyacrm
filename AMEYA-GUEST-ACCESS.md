# Ameya Heights CRM — Guest / Demo Access

A shareable login you can hand to **anyone** — a prospect, partner, investor or new hire — to let them explore the platform hands-on, without exposing a single piece of real company data.

## How to create one

1. Sign in as an admin → **Admin → Users → Add user**.
2. Fill in a name and email (e.g. "Guest Preview", `preview@ameyaheights.com`), set a password.
3. Set the **Role** to **Guest**.
4. Save, and share those login credentials with whoever you want to show around.

You can make as many guest logins as you like, and disable one at any time from the same screen. (Tip: use a throwaway email and a simple shared password, since this account can't do anything sensitive.)

## What a guest sees and can do

A guest lands on a **Demo Overview** screen with sample KPIs (leads, flats, pipeline value, bank receipts) and links to four interactive demo screens. Every number is fictional sample data, seeded into the guest's own private sandbox.

The guest can **create, edit and delete freely** inside the sandbox — it is not read-only. The five screens are:

| Screen | Route | What the guest can do |
|---|---|---|
| Overview | `/demo` | See KPIs, recent activity, and notes. Add a note. |
| Sales | `/demo/sales` | Add a lead, change its stage through the pipeline, delete a lead. |
| Inventory | `/demo/inventory` | View sample flats by tower, filter by tower, set a unit to Available / Held / Booked. |
| Tasks | `/demo/tasks` | Add a task with a due date, tick it done or reopen it, see overdue items highlighted. |
| Ameya Tally | `/demo/tally` | Post a double-entry journal entry and watch the trial balance prove debits equal credits. |

Each screen has a **Reset demo** button that puts the sandbox back to its seeded state. The sandbox also resets itself automatically after 24 hours.

Real staff members can also visit `/demo` to show the product to a prospect without handing over a guest login.

## What a guest can never do or see — three independent locks

1. **No real data is ever loaded.** Demo pages read only `Sandbox*` tables (sandbox leads, units, tasks, ledger entries, notes). A real page component is never invoked for a guest, so there is no query that could return company data and no `where` clause to forget.
2. **Sealed navigation (default-deny).** The app layout unconditionally redirects any guest to `/demo`. Any other URL — dashboards, finance, documents, admin, email, anything — bounces back to the demo. New screens added to the real CRM in future are blocked by default, not exposed by accident. `/demo` lives in a separate route group so the redirect cannot loop.
3. **Zero permissions on real data.** The Guest role carries zero permission keys, so even if a real screen were somehow reached, it would render nothing. Every real server action goes through `getActionContext()`, which throws `ForbiddenError` for a guest unconditionally. The sandbox actions in `sandbox.ts` deliberately bypass that helper and write only to sandbox tables, scoped by the session-derived sandbox ID — a guest cannot address another guest's playground.

IMAP / email, exports, downloads, settings and integrations are all unavailable to a guest by construction — there's nothing to configure and no credentials involved.

## Good to know

- Nothing about your real workspace changes for your real users.
- The sandbox is per-user: each guest gets their own private playground. What one guest does does not affect another guest's demo.
- Want guests to explore more screens (with realistic *fake* records they can click through)? The sandbox foundation supports adding more demo screens on top of it — ask and I'll extend it to whichever modules you most want to demo.
