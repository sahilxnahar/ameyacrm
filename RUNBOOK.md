# Ameya Heights CRM — Operations Runbook

**Purpose:** so that someone other than Sahil can deploy, fix and recover this system.
Print it. Keep a copy somewhere that does not depend on the CRM being up.

---

## 1. Who can do what

| Role | Person | What they can do |
|---|---|---|
| Primary deployer | Sahil Nahar | Everything |
| **Second deployer** | _(name here)_ | Deploy, restore a backup, rotate a secret |
| Database owner | Sahil Nahar | Neon console |
| Domain owner | Sahil Nahar | DNS |

> **The single biggest operational risk today is that this table has one name in it.**
> Fill in the second row and complete section 8.

## 2. What runs where

| Piece | Where | Account |
|---|---|---|
| Application | Vercel — project `ameyacrm` | Vercel (Hobby) |
| Database | Neon Postgres — `ameyacrm` | Neon (Free) |
| File storage | Vercel Blob | Same Vercel account |
| Scheduled jobs | Google Apps Script (hourly) + Vercel cron (daily 01:00) | Google account |
| Email | Gmail SMTP as `hi@ameyaheights.com`, sending as `crm@ameyaheights.com` | Google Workspace |
| AI | Google Gemini (AI Studio key) | Google account |
| Source code | GitHub — `ameyacrm` | GitHub |

## 3. Deploying a new version

1. Unzip the release into the GitHub Desktop repository folder — **select all, delete, paste**.
2. If the release includes a `MIGRATION_*.sql`, run it in **Neon → SQL Editor first**.
   Migrations are written to be safe to re-run; "already exists, skipping" is success.
3. GitHub Desktop → Commit → Push.
4. Vercel → Deployments → **Create Deployment → main → Deploy to Production**.
   **Do not use "Redeploy"** — that re-runs the previous commit and is the single
   most common mistake with this project.
5. Watch the build. If it fails, read section 5.
6. Open the site, sign in, and check one page that the release touched.

## 4. Routine checks

| How often | What | Where |
|---|---|---|
| Daily | Anything unresolved? | Admin → Errors |
| Daily | Are the hourly jobs running? | Apps Script → Executions |
| Weekly | Are integrations still live? | Admin → Integrations |
| Weekly | Is anyone drowning in overdue work? | Calendar → Who has what |
| Monthly | Download a backup and keep it off-platform | Admin → Security Center |
| Monthly | Restore drill — see section 7 | |

## 5. When the build fails

| Message | Cause | Fix |
|---|---|---|
| `This cron expression would run more than once a day` | A sub-daily cron in `vercel.json` | Vercel Hobby allows one per day. Use the Apps Script trigger instead. |
| `P1012 ... not an enum value definition` | An enum written on one line in `schema.prisma` | Each value must be on its own line. |
| `Only async functions are allowed to be exported in a "use server" file` | A `const` or object exported from a file in `src/server/actions/` | Move it to `src/config/`. |
| `Cannot find module` | A file missing from the release | Re-copy the release folder; check nothing was left behind. |

## 6. When the site is down

1. Open `https://ameyacrm.vercel.app/api/health` — it answers even when the UI does not.
   - `{"status":"ok"}` → the app and database are fine; the problem is elsewhere.
   - `{"status":"degraded","db":"down"}` → Neon. Check the Neon console.
   - No response → Vercel. Check the Vercel status page and your Deployments tab.
2. If a recent deploy broke it: Vercel → Deployments → find the last good one →
   **Promote to Production**. That is the fastest rollback available.
3. Tell people. A two-line WhatsApp message beats silence.

## 7. Backup and restore

**Backups** run nightly to Blob storage and can be downloaded any time from
Admin → Security Center → *Download full backup (JSON)*.

**Keep one copy off-platform.** A backup that lives only in the same Vercel account
is not a backup.

**Restore drill — do this once a quarter:**
1. Neon → Branches → create a branch from a point in time.
2. Point a Vercel *preview* deployment at that branch's connection string.
3. Sign in and confirm the data is there.
4. Delete the branch.

If you have never tested a restore, you do not have backups. You have hope.

## 8. Setting up the second deployer

1. Create their CRM account and give them **SUPER_ADMIN**.
2. Add them to the **Vercel** project as a Member.
3. Add them to the **GitHub** repository with write access.
4. Add them to the **Neon** project.
5. Share the credentials for the Google account that runs the Apps Script.
6. Walk them through section 3 **on a real release** while you watch. Reading is not learning.
7. Have them do section 7's restore drill, alone, once.
8. Write their name in the table in section 1.

## 9. Secrets — where they live and how to change one

All application secrets live in **Vercel → Settings → Environment Variables**.
They are marked Sensitive, which means **Vercel will never show them to you again**.
Keep a copy in a password manager.

To rotate one: edit the value in Vercel → **Create Deployment** (env changes do not
apply to existing deployments) → update anywhere else it appears, such as
`CRON_KEY` and `INGEST_KEY` in the Apps Script.

| Secret | Used for | Also lives in |
|---|---|---|
| `DATABASE_URL` | Everything | — |
| `SESSION_SECRET`, `ENCRYPTION_KEY` | Logins, 2FA secrets | — |
| `CRON_SECRET` | Hourly and daily jobs | Apps Script `CRON_KEY` |
| `INGEST_SECRET` | Portal, social and website lead capture | Apps Script `INGEST_KEY` |
| `GEMINI_API_KEY` | All AI features | — |
| `BLOB_READ_WRITE_TOKEN` | File uploads | — |
| `SMTP_PASS` | Outbound email | Google app password |
| `GAS_SECRET` | Drive and Sheets | Apps Script `SECRET` |

**Changing `SESSION_SECRET` or `ENCRYPTION_KEY` signs everyone out and breaks
existing 2FA enrolments.** Only do it in a real security incident.

## 10. About support

There is no vendor to ring. That is the trade for ₹0 per user and full ownership.
What replaces a support contract:

- **This runbook**, kept current.
- **A second deployer** who has actually deployed, not just been told how.
- **Error monitoring** that emails admins the first time anything new breaks.
- **Backups you have tested restoring.**

If you want a genuine support contract, it is a commercial arrangement with a
development agency or a freelance engineer — typically a monthly retainer for a
defined response time. That is a decision to make and a person to hire; no amount
of software substitutes for it.
