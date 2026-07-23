# Ameya Heights CRM — Master Details

> ⚠️ **PRIVATE — DO NOT COMMIT TO GITHUB OR SHARE.** This file contains live
> secrets. Keep it only in the `KEEP-PRIVATE` folder on your own machine. If it
> ever leaks, rotate every key listed here.
>
> Last updated: 23 Jul 2026 · CRM version at time of writing: **v14.69**

---

## 1. The map — where everything lives

| Thing | Where | Address / ID |
|---|---|---|
| Public website | Vercel / your host | **ameyaheights.com** |
| The CRM app | Vercel | **crm.ameyaheights.com** |
| Database | Neon (Postgres) | Neon dashboard → project → connection string (`DATABASE_URL`) |
| Real-time relay | Deno Deploy | **https://ameyacrm.sahilnahar.deno.net** |
| WhatsApp gateway | OpenWA (Docker on your laptop) | **localhost:2785** (local only) |
| WhatsApp public URL | ngrok tunnel | **https://grafting-jaundice-taco.ngrok-free.dev** |
| External cron pinger | cron-job.org | your cron-job.org account |
| Email + SSO + groups | Google Workspace | ameyaheights.com workspace |
| Source code | GitHub | your repo |
| AI | OpenRouter | openrouter.ai dashboard |

---

## 2. Apps & services we use (and what each one is for)

- **Vercel** — hosts the CRM (Next.js). Deploys, environment variables, the one built-in cron. Domain: crm.ameyaheights.com.
- **Neon** — the Postgres database. All CRM data lives here. Migrations (the `MIGRATION_*.sql` files) are run in Neon's SQL editor.
- **Deno Deploy** — the always-on real-time relay so changes appear live across users. URL: ameyacrm.sahilnahar.deno.net. Source: `relay.ts`.
- **OpenWA** (self-hosted, unofficial WhatsApp) — runs in Docker on your laptop at localhost:2785. Sends CRM WhatsApp messages (reminders, receipts, broadcasts). Only works while the laptop + Docker + ngrok are running.
- **ngrok** — exposes the local OpenWA server to the internet so the cloud CRM can reach it. Free auto-domain: grafting-jaundice-taco.ngrok-free.dev.
- **cron-job.org** — pings the CRM's cron endpoints on a schedule (Vercel Hobby only allows one built-in daily cron, so the rest are triggered from here).
- **Google Workspace** — company email, the `cp@ameyaheights.com` group, and Single Sign-On. (Uses the Workspace admin console — **not** Google Cloud Console.)
- **OpenRouter** — the AI provider (bill reading, the Assistant, lead scoring). Speaks the OpenAI API shape; keys rotate automatically.
- **GitHub** — stores the code.
- **Maps** — MapLibre (bundled in the app) + OpenStreetMap tiles + Nominatim geocoding. **Keyless** — no Google Maps, no bill.

---

## 3. APIs the CRM calls

| API / service | Used for | Auth (env var) | Notes |
|---|---|---|---|
| OpenRouter | AI: bill reader, Assistant, lead scoring | `AI_API_KEY` + `AI_API_KEYS` | Base `AI_BASE_URL=https://openrouter.ai/api/v1`, model `AI_MODEL`. Keys tried in turn on failure. |
| Google Gemini (optional) | Alternate AI provider | `GEMINI_API_KEY` | Only used if set; OpenRouter is primary. |
| OpenWA | Send WhatsApp | `OPENWA_API_URL`, `OPENWA_API_KEY`, `OPENWA_SESSION_ID` | POST to `/api/sessions/<id>/messages/send-text`. |
| Vercel Blob | File uploads (proofs, avatars, docs) | `BLOB_READ_WRITE_TOKEN` | Storage for anything uploaded. |
| Web Push (VAPID) | Phone/desktop push notifications | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Generate with `npx web-push generate-vapid-keys`. |
| Neon Postgres | The database | `DATABASE_URL` (+ `DATABASE_URL_UNPOOLED`) | Unpooled URL used for schema changes. |
| OpenStreetMap / Nominatim | Map tiles + geocoding | none (keyless) | Public, free. |
| Google Apps Script (optional) | Personal Drive/Sheets sync without Cloud Console | `GAS_WEBAPP_URL`, `GAS_SECRET` | The `Code.gs` connector. |
| Email (SMTP/SES/Resend) | Outbound email | `EMAIL_PROVIDER` + provider keys | `console` = just logs, for testing. |
| Lead ingestion webhook | Website forms → CRM leads | `INGEST_SECRET` | `POST /api/ingest/lead?key=...` |
| Channel-partner webhook | Website CP form → CRM | `INGEST_SECRET` | `POST /api/ingest/partner?key=...` |
| Telephony webhook | Call-recording provider (when added) | `TELEPHONY_SECRET` | `/api/telephony/webhook` |
| Cron endpoints | Scheduled jobs | `CRON_SECRET` | See section 5. |

---

## 4. Live credentials & IDs

> Keep these secret. Rotate if leaked.

**Deployment**
- Website: `ameyaheights.com`
- CRM: `crm.ameyaheights.com`
- Real-time relay: `https://ameyacrm.sahilnahar.deno.net`

**WhatsApp / OpenWA**
- Local server: `http://localhost:2785`
- Public (ngrok): `https://grafting-jaundice-taco.ngrok-free.dev`
- ngrok start command: `ngrok http 2785 --url=https://grafting-jaundice-taco.ngrok-free.dev`
- ngrok auth token: `3GqyrNoEPw5bzDP9KY3gURx6Ipw_3HSrBRYwxE1h6826ZcQAZ`
- OpenWA API key: `owa_k1_5ab311a04a3cec3cb19e3fde9834323d2dd17d6cd87fabb07e5d1314b19f3f44`
- OpenWA session — **SN personal (connected, currently in use):** `755e50fb-d2a0-49bd-baf6-5f5d82cb39b2`
- OpenWA session — **Ameya CRM WA (dedicated, not yet connected):** `9b4712bf-a4bd-49ba-a649-b917a81cc648`

**OpenRouter AI keys** (put key #1 in `AI_API_KEY`, the rest comma-joined in `AI_API_KEYS`):
1. `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`
2. `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`
3. `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`
4. `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`

**Google Workspace**
- Channel-partner group inbox: `cp@ameyaheights.com` (3–4 accounts receive it)

> `DATABASE_URL` (Neon), `SESSION_SECRET`, `ENCRYPTION_KEY`, `BLOB_READ_WRITE_TOKEN`, `CRON_SECRET`, `INGEST_SECRET`, VAPID keys — these live **only** in Vercel's Environment Variables. Copy them from there; they are not duplicated here on purpose.

---

## 5. Cron jobs (scheduled tasks)

All cron endpoints are guarded by `CRON_SECRET` — call with `?key=<CRON_SECRET>` or header `Authorization: Bearer <CRON_SECRET>`.

| Endpoint | What it does | Schedule | Runs from |
|---|---|---|---|
| `/api/cron/daily` | One daily maintenance pass — escalations, releases, summaries | `0 1 * * *` (01:00 UTC daily) | **Vercel** (the one built-in cron) |
| `/api/cron/reminders` | Fires due reminders as notifications/push | every few minutes | **cron-job.org** |
| `/api/cron/payment-reminders` | Flags overdue milestones, accrues interest, nudges reps | daily | **cron-job.org** |
| `/api/cron/escalate` | Overdue escalation + onboarding reminders + email sequences | hourly | **cron-job.org** |
| `/api/cron/auto-release` | Releases expired unit holds back to available | hourly | **cron-job.org** |
| `/api/cron/backup` | Writes a JSON snapshot of the database to storage | nightly | **cron-job.org** |

To set one up on cron-job.org: URL = `https://crm.ameyaheights.com/api/cron/<name>?key=YOUR_CRON_SECRET`, method GET, on the schedule above.

---

## 6. Environment variables (Vercel → Settings → Environment Variables)

**Required**
- `DATABASE_URL` — Neon connection string
- `SESSION_SECRET` — ≥32 chars (`openssl rand -base64 48`)
- `ENCRYPTION_KEY` — 32-byte key

**AI (OpenRouter)**
- `AI_BASE_URL` = `https://openrouter.ai/api/v1`
- `AI_API_KEY` — primary key
- `AI_API_KEYS` — spare keys, comma-separated
- `AI_MODEL` — e.g. `google/gemini-2.5-flash`
- `AI_EMBED_MODEL` — optional, for search
- `AI_FALLBACK_BASE_URL` / `AI_FALLBACK_API_KEY` / `AI_FALLBACK_MODEL` — optional second provider
- `GEMINI_API_KEY` / `GEMINI_MODEL` — optional Google AI

**Storage & files**
- `BLOB_READ_WRITE_TOKEN` — Vercel Blob
- `STORAGE_PROVIDER` (`blob` / `s3` / `local`), plus `S3_*` if using S3

**WhatsApp (OpenWA)**
- `OPENWA_API_URL` = `https://grafting-jaundice-taco.ngrok-free.dev`
- `OPENWA_API_KEY` = your `owa_...` key
- `OPENWA_SESSION_ID` = the session id in use
- (Meta official option, if ever used: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_WABA_ID`, `WHATSAPP_VERIFY_TOKEN`, `META_APP_SECRET`)

**Webhooks & secrets**
- `INGEST_SECRET` — website lead + channel-partner capture
- `CRON_SECRET` — guards the cron endpoints
- `TELEPHONY_SECRET` — call-recording webhook
- `SETUP_SECRET` — guards `/api/setup` after first run

**Email**
- `EMAIL_PROVIDER` (`smtp` / `ses` / `resend` / `console`), `EMAIL_FROM`
- `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_SECURE` — for SMTP
- `RESEND_API_KEY` — for Resend
- `AWS_SES_REGION` — for SES

**Push notifications**
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`

**Google (optional, personal — no Cloud Console)**
- `GAS_WEBAPP_URL`, `GAS_SECRET` — Apps Script Drive/Sheets connector
- `GOOGLE_SHEETS_ID`, `GOOGLE_DRIVE_FOLDER_ID` — targets

**App**
- `APP_URL` = `https://crm.ameyaheights.com`
- `APP_NAME` = `Ameya Heights CRM`

---

## 7. First-time setup / redeploy checklist

1. Set all required env vars in Vercel (section 6).
2. Deploy the latest zip to Vercel.
3. Run any pending `MIGRATION_*.sql` files in Neon's SQL editor, in version order.
4. Visit `https://crm.ameyaheights.com/api/setup` once (first run) to seed the database.
5. After changing any env var, **Redeploy** in Vercel — env changes only take effect on a new deployment.
6. For WhatsApp: keep laptop on with Docker (OpenWA) + ngrok running.
7. For the crons: make sure the cron-job.org jobs point at the current CRON_SECRET.

---

## 8. How to run WhatsApp (quick)

1. Start Docker + OpenWA (serves localhost:2785).
2. Start ngrok: `ngrok http 2785 --url=https://grafting-jaundice-taco.ngrok-free.dev`
3. Confirm `OPENWA_API_URL` in Vercel matches the ngrok URL; redeploy if changed.
4. The CRM then sends reminders, receipts and broadcasts through the connected session.
   Messages only go out while laptop + Docker + ngrok are all running.
