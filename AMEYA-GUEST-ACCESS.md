# Ameya Heights CRM — Guest / Preview Access (v15.87)

A shareable, read-only login you can hand to **anyone** — a prospect, partner, investor or new hire — to show off the whole platform, without exposing a single piece of real company data.

## How to create one

1. Sign in as an admin → **Admin → Users → Add user**.
2. Fill in a name and email (e.g. "Guest Preview", `preview@ameyaheights.com`), set a password.
3. Set the **Role** to **Guest**.
4. Save, and share those login credentials with whoever you want to show around.

You can make as many guest logins as you like, and disable one at any time from the same screen. (Tip: use a throwaway email and a simple shared password, since this account can't do anything sensitive.)

## What a guest sees

A single polished **Product Preview** screen: sample KPIs (revenue, leads, units, collections), a sample sales pipeline, sample construction progress and a live compliance snapshot — plus a complete map of every module in the platform (90+ features, grouped by area). Every number is illustrative sample data, hard-coded into the preview page.

## What a guest can never do or see — three independent locks

1. **No real data is ever loaded.** The preview page reads nothing from the database; it renders fixed sample figures. A guest request returns before the app ever queries real projects, leads, money, documents or email.
2. **Sealed navigation (default-deny).** A guest can only reach the preview screen. Any other URL — dashboards, finance, documents, admin, email, anything — automatically redirects back to the preview. New screens added in future are blocked by default, not exposed by accident.
3. **Strictly read-only.** Every action that could change data is refused for a guest at the server, regardless of the request. The Guest role also carries zero data permissions, so even if a screen were somehow reached, it would render nothing.

IMAP / email, exports, downloads, settings and integrations are all unavailable to a guest by construction — there's nothing to configure and no credentials involved.

## Good to know

- Nothing about your real workspace changes for your real users.
- Want guests to explore actual working screens (with realistic *fake* records they can click through), not just the showcase page? That's a larger build — a seeded sample dataset per module — and can be added screen by screen on top of this foundation. Ask and I'll extend it to whichever modules you most want to demo.
