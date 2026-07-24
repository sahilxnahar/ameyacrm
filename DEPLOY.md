# Deploy Ameya Heights CRM (no terminal required)

You can run this fully on a cloud platform — no local install, no command line. The
recommended path is **Vercel + Vercel Postgres (Neon) + Vercel Blob**. A Netlify note
follows.

---

## Option A — Vercel (recommended, ~10 minutes)

### 1. Get the code onto GitHub
- Download the project zip, unzip it, and upload the `ameya-heights-crm` folder to a new
  **GitHub repository** (GitHub.com → *New repository* → *uploading an existing file* → drag
  the folder contents). No git commands needed.

### 2. Import into Vercel
- Vercel.com → **Add New… → Project** → import your GitHub repo.
- Framework is auto-detected as **Next.js**. Leave the build settings as-is.
- **Note on migrations:** the Vercel build runs `prisma generate && next build` — it does
  **not** run database migrations. On a brand-new database the schema is created on the first
  `/api/setup` call (step 7). For **updates** to an existing database, you run the release's
  `MIGRATION_*.sql` yourself in Neon — see “Updating an existing deployment” below. This is by
  design, so a deploy can never half-apply a schema change.

### 3. Add a database (Vercel Postgres / Neon)
- In the project, open **Storage → Create Database → Postgres** and connect it.
- This auto-adds `DATABASE_URL` (and related vars). If your integration names it
  `POSTGRES_PRISMA_URL` instead, add an env var **`DATABASE_URL`** whose value is that
  connection string.

### 4. Add file storage (Vercel Blob)
- **Storage → Create → Blob** and connect it. This auto-adds `BLOB_READ_WRITE_TOKEN`.
- Add env var **`STORAGE_PROVIDER`** = `blob`.

### 5. Set the two required secrets
Add these Environment Variables (Project → Settings → Environment Variables). Use any long
random strings (≥32 chars):
- `SESSION_SECRET` = a 48-char random string
- `ENCRYPTION_KEY` = a different 48-char random string

Optional but recommended:
- `EMAIL_PROVIDER` = `resend` and `RESEND_API_KEY` = your Resend key (else leave unset →
  emails are logged to the function logs).
- `APP_URL` = your deployed URL (e.g. `https://ameya-crm.vercel.app`).
- `SETUP_SECRET` = a random string (lets you safely re-run setup later).
- Web push (optional): `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (generate once at
  https://vapidkeys.com), `VAPID_SUBJECT` = `mailto:you@yourdomain.com`.

### 6. Deploy
- Click **Deploy**. The build no longer touches the database, so it can't fail on DB
  connectivity — your schema is created in the next step, on first `/api/setup` call.

### 7. Create tables + seed data (one click, no terminal)
- After the deploy succeeds, initialize the database by sending a POST to `/api/setup`.
  Easiest ways:
  - Open your site’s `/api/setup` in a browser to confirm status (GET shows
    `{"initialized": false}`), then run the POST using any of:
    - A browser extension / REST client (Hoppscotch, Postman): `POST https://<your-app>/api/setup`
    - Or paste this in the browser console on your site:
      `fetch('/api/setup', { method: 'POST' }).then(r => r.json()).then(console.log)`
- `/api/setup` **creates the database schema (all tables) if missing, then seeds** RBAC,
  departments, the project, and the Super Admin — no `prisma migrate` needed.
- The response returns the **Super Admin credentials** (default `superadmin` /
  `Ameya@Heights2026`, or your `SETUP_*` overrides). Sign in and **change the password
  immediately** (you’ll be prompted).

You’re live. Re-deploys are automatic on every GitHub push.

---

## Updating an existing deployment (IMPORTANT — do this or it can break)

When you deploy a new version onto a database that already has data, the code and the
database must move together. The code is deployed by pushing to GitHub; the database is
**not** touched by the build, so any schema change ships as a `MIGRATION_*.sql` file you run
yourself. Skipping it makes pages that use the new columns throw errors.

**Order for every update:**

1. **Look at which `MIGRATION_*.sql` files are new** since your last deploy (they’re named by
   version, e.g. `MIGRATION_v15.13_all.sql`). Every migration in this project is idempotent —
   safe to run again — so when unsure, run the recent ones; “already exists, skipping” means
   it was already applied.
2. **Run them in Neon → SQL Editor, in version order, _before or immediately after_ pushing
   the code.** For the smoothest result, run the SQL first, then push — the new code then
   finds the columns it expects.
3. Push the code to GitHub (Vercel auto-deploys). No `/api/setup` needed for an update — it
   only ever creates a schema that is entirely missing, and never alters existing tables.

> **This release (v15.14):** run **`MIGRATION_v15.13_all.sql`** in Neon if you have not
> already (it adds the channel-partner commission-basis columns). v15.14 itself adds no new
> migration. If you skip v15.13, the Partners screen, the daily cron, the briefing, search and
> the nightly backup will error until it is run.

---

## Option B — Netlify / other

Netlify runs Next.js via the official adapter. Use an S3-compatible store instead of Vercel
Blob:
- **Database:** Neon or Supabase Postgres → set `DATABASE_URL`.
- **Storage:** Supabase Storage or Cloudflare R2 (both S3-compatible) → set
  `STORAGE_PROVIDER=s3`, `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`,
  `S3_SECRET_ACCESS_KEY`, `S3_REGION`.
- **Build command:** `npm run vercel-build` (works on Netlify too — it runs `prisma generate`
  then builds; it does **not** run migrations, same as Vercel — see “Updating an existing
  deployment”). **Publish/adapter:** install `@netlify/plugin-nextjs` (Netlify adds it
  automatically for Next.js).
- Set `SESSION_SECRET`, `ENCRYPTION_KEY`, then initialize via `/api/setup` as in step 7.

---

## Environment variable reference

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | ✅ | Postgres connection string (Neon/Supabase/Vercel Postgres) |
| `SESSION_SECRET` | ✅ | ≥32 random chars |
| `ENCRYPTION_KEY` | ✅ | ≥32 random chars (encrypts 2FA secrets) |
| `STORAGE_PROVIDER` | ✅ on serverless | `blob` (Vercel) or `s3` (Netlify/other). `local` is dev-only |
| `BLOB_READ_WRITE_TOKEN` | if `blob` | auto-set by Vercel Blob |
| `S3_*` | if `s3` | endpoint/bucket/keys/region |
| `EMAIL_PROVIDER` + keys | optional | `resend` / `smtp` / `ses` / `console` (default logs) |
| `VAPID_*` | optional | enables web-push notifications |
| `SETUP_SECRET`, `SETUP_*` | optional | guard + customize the one-time bootstrap |

## Notes & caveats
- **Vercel Blob URLs are public but unguessable.** Downloads are still permission-checked and
  audited via `/api/files/[id]` before redirecting. For strict private storage, use S3 with
  signed URLs (already supported).
- **Serverless has no persistent disk** — do not use `STORAGE_PROVIDER=local` in production.
- Long-running background jobs (digests, expiry sweeps) should run via a scheduled trigger
  (Vercel Cron) hitting a protected route — see the automation module.
