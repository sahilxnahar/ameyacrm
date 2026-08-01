# 1 — Deploying for the first time

From an empty account to a working CRM. Around 30 minutes.

## What you need before you start

- The application `.zip`
- A credit card (Neon and Vercel both have free tiers that fit this app; a paid
  tier matters only for scale)
- An email address you control for the first admin account

---

## Step 1 — Create the database

1. Go to **neon.tech** and sign up.
2. Create a project. Pick the region closest to your users —
   **AWS ap-south-1 (Mumbai)** for an Indian team. This one choice affects
   every page load; a database in the US adds roughly 200 ms to *every* query.
3. From the dashboard, copy the connection string. It looks like:

   ```
   postgresql://user:password@ep-xyz-123.ap-south-1.aws.neon.tech/neondb?sslmode=require
   ```

4. Copy it **twice** — Neon shows a pooled and a direct connection string. You
   need both:
   - the **pooled** one → `DATABASE_URL`
   - the **direct / unpooled** one → `DATABASE_URL_UNPOOLED`

   Migrations must run on the direct connection; a pooler will not hold the
   session-level locks a migration takes.

## Step 2 — Create the tables

On your own machine, with the zip unpacked:

```bash
npm install
export DATABASE_URL="…the pooled string…"
export DATABASE_URL_UNPOOLED="…the direct string…"
npx prisma db push
```

`db push` builds the whole schema from scratch. This is the right command for a
**brand-new, empty** database only — see `03-DATABASE.md` for upgrading one that
already holds data.

## Step 3 — Generate your secrets

```bash
# Session signing key — rotating this signs everybody out
openssl rand -base64 48

# Cron authentication
openssl rand -base64 32
```

Keep these somewhere safe. A password manager, not a text file on the desktop.

## Step 4 — Deploy

1. Push the code to a private GitHub repository.
2. At **vercel.com**, "Add New Project" and import that repository.
3. Framework preset: **Next.js** (Vercel detects this on its own).
4. Before clicking Deploy, open **Environment Variables** and add the minimum
   set from `02-ENVIRONMENT.md`.
5. Deploy.

The first build takes 3–6 minutes.

## Step 5 — Create the first admin

Visit your new URL. The CRM detects an empty user table and offers a one-time
setup screen for the first super-admin account. Use a real email — it is where
password resets go.

> If the setup screen does not appear, the database already has users in it.
> Check you pointed at the right database.

## Step 6 — Turn on the scheduled jobs

Vercel reads `vercel.json` and registers the cron jobs by itself. Confirm under
**Settings → Cron Jobs** that they are listed. They drive:

- overdue payment flagging and demand letters
- the daily briefing
- webhook retries
- guest sandbox cleanup

They will not run unless `CRON_SECRET` is set.

## Step 7 — Check it over

- [ ] You can sign in
- [ ] **Admin → Users** loads
- [ ] **Ameya Tally** opens and shows a Day Book
- [ ] Creating a test lead works
- [ ] **Settings → Integrations** shows which optional services are configured

Delete the test lead. You are live.
