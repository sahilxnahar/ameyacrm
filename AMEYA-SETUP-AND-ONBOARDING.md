# Ameya Heights CRM / ERP — Setup & Onboarding (Master)

_Everything you need to stand the system up from zero, wire every capability, and onboard your first users. Companion file: **`.env.example`** (copy-paste-ready variable list). Version baseline: **v15.81**._

---

## 1. What you're deploying

Ameya OS is a Next.js 15 (App Router) / React 19 / TypeScript application backed by PostgreSQL (Neon), using Prisma as the ORM, deployed on Vercel. Files go to Vercel Blob (or any S3-compatible store). AI runs through an OpenAI-compatible provider (OpenRouter, with a Groq fallback). It ships ~189 screens across 90+ operational modules — sales/CRM, finance & tax, construction/site ops, legal & due diligence, vendor & labour, procurement, and corporate approvals.

The golden rule that underpins everything below: **the app boots on three secrets; every other variable lights up one extra capability and nothing breaks when it's absent.** Features that need a key you haven't set simply show a quiet "connect this" state instead of failing.

---

## 2. Prerequisites (accounts)

You must have: a **Neon** account (PostgreSQL), a **Vercel** account (hosting), and — for the AI features — an **OpenRouter** account (four API keys; see §6). Everything else is optional and can be added later: Google AI Studio (Gemini, an alternate AI path), a mail path (Gmail app password / Resend / AWS SES), Meta WhatsApp or an OpenWA server, Google Workspace (Sheets/Drive sync), and the various Indian-compliance feeds (GST GSP, Karza/Signzy UAN, SHCIL e-stamp, IBBI, cause-lists).

---

## 3. The three required secrets

The app will not boot without these three. Generate them once and store them in Vercel.

```bash
# DATABASE_URL — copy the POOLED connection string from Neon (the "-pooler" host)
# SESSION_SECRET — at least 32 chars
openssl rand -base64 48
# ENCRYPTION_KEY — at least 32 chars, generate separately
openssl rand -base64 48
```

**`ENCRYPTION_KEY` must never be rotated once the system is live.** It encrypts stored PII, 2FA secrets, and per-user IMAP/SMTP passwords. Changing it makes all of those permanently undecryptable. Treat it as write-once.

---

## 4. First deploy — step by step

1. **Create the Neon database.** Copy both the pooled (`-pooler`) and direct connection strings. Put the pooled one in `DATABASE_URL`, the direct one in `DATABASE_URL_UNPOOLED` (used for migrations).
2. **Import the repo into Vercel** (New Project → import). Framework preset auto-detects Next.js.
3. **Set environment variables in Vercel** → Settings → Environment Variables. At minimum the three from §3; add `STORAGE_PROVIDER=blob` and a `BLOB_READ_WRITE_TOKEN` (create a Vercel Blob store first) so uploads work; add the AI keys from §6 to switch on the assistant, bill-reader and briefings. Use `.env.example` as your checklist.
4. **Deploy.** The build does not require secrets to be present (env is enforced at runtime, not build time), so the first build succeeds even before you finish filling keys in.
5. **Run the database migrations** (§5) in Neon — this is the step most often missed and the cause of "the feature is there but does nothing" symptoms.
6. **Bootstrap the first admin.** Set `SETUP_EMAIL`, `SETUP_NAME`, `SETUP_USERNAME`, `SETUP_PASSWORD` and optionally `SETUP_SECRET`, redeploy, then visit `/api/setup` once. It creates the first `SUPER_ADMIN`. Afterwards remove the `SETUP_*` values (keep `SETUP_SECRET` if you want the endpoint to stay guarded) and change that password on first login.
7. **Log in** at your `APP_URL` and confirm the Command Center loads.

---

## 5. Database & migrations (do not skip)

The schema is applied by running the `MIGRATION_*.sql` files **in ascending version order** in the Neon SQL editor. Each file is idempotent (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, guarded enum/constraint blocks), so re-running one is harmless.

Two migrations are the current known blockers if you're upgrading an existing database:

- **Per-user email** (the "still mapped to hi@" symptom): run `MIGRATION_v15.71_all.sql` (adds the User IMAP columns) and `MIGRATION_v15.78_all.sql` (adds the User SMTP columns). Without them, the per-user mailbox lookup throws and silently falls back to the shared mailbox.
- **Due Diligence vault** (the `type "RecordType" does not exist` error): run `MIGRATION_DueDiligence_combined_v72_v75.sql` (self-contained: creates the enum + table, then adds the newer record-type values).
- **Latest**: `MIGRATION_v15.81_all.sql` adds the Site Ops daily-log tables (`DailySiteLog`, `SitePhoto`). No-op if you already ran v15.80.

For a brand-new database you can instead let the app build the whole schema at runtime via `/api/setup` (guarded by `SETUP_SECRET`) — the init-schema SQL is bundled — then only future migrations need running manually.

---

## 6. The four OpenRouter API keys (AI)

The assistant, the AI bill-reader, the GRN scanner, document summaries and the daily briefing all run through **one OpenRouter account with four API keys pooled together for resilience.** When one key runs out of credit or hits its rate limit, the next is tried automatically (round-robin, and a dead key is remembered and skipped on a warm instance). This is why you set up four rather than one — it keeps AI alive under load and when a key's free credit is exhausted.

How the four map onto environment variables:

| # | Variable | Role |
|---|----------|------|
| **API #1** | `AI_API_KEY` | Primary key — tried first. |
| **API #2, #3, #4** | `AI_API_KEYS` | The three spare keys, **comma-separated in one variable**, tried in turn after #1. |

Plus the shared provider settings: `AI_BASE_URL=https://openrouter.ai/api/v1` and `AI_MODEL` (e.g. `google/gemini-2.5-flash`). Optionally `AI_EMBED_MODEL` for smarter "Ask Documents" search, and a whole **second provider** as a last resort (`AI_FALLBACK_BASE_URL` / `AI_FALLBACK_API_KEY` / `AI_FALLBACK_MODEL` — typically Groq's free tier).

Example (values redacted — put the real ones only in Vercel, never in the repo):

```
AI_BASE_URL=https://openrouter.ai/api/v1
AI_MODEL=google/gemini-2.5-flash
AI_API_KEY=sk-or-v1-…KEY-1                                  # OpenRouter API #1
AI_API_KEYS=sk-or-v1-…KEY-2,sk-or-v1-…KEY-3,sk-or-v1-…KEY-4  # OpenRouter APIs #2–#4
```

**Where the real key values live and how to see them:** the actual secret strings are stored only in Vercel's Environment Variables (and in your sealed private backup) — they are never written into the codebase or any document, by policy. To confirm the four are loaded and working without opening Vercel, sign in as an admin and open **Admin → AI health**: it runs the AI for real and shows the live key count (e.g. "4 keys") and which model answered. If you need to read or rotate the values themselves, do it in the Vercel dashboard; if you rotate a key, redeploy so the new value is picked up. (Rotating an *AI* key is safe — unlike `ENCRYPTION_KEY`, which must never change.)

---

## 7. Full environment-variable reference

The authoritative, copy-paste list with per-variable comments and required/optional/default markers is **`.env.example`** in the repo root. It is grouped exactly as below. The short version:

**Required (3):** `DATABASE_URL`, `SESSION_SECRET`, `ENCRYPTION_KEY`.

**Strongly recommended for a useful deployment:** `STORAGE_PROVIDER=blob` + `BLOB_READ_WRITE_TOKEN` (uploads), the OpenRouter keys from §6 (AI), and a mail path (§9).

**Everything else is optional** and grouped: core app (`APP_URL`, `APP_NAME`), sessions/auth policy, first-run bootstrap (`SETUP_*`), storage (S3/MinIO/R2), AI (OpenRouter pool + Gemini + fallback), email out (SMTP/SES/Resend), email in (IMAP), web push (VAPID), real-time relay, WhatsApp (three interchangeable gateways), webhook/ingest guards, Google Workspace sync, finance/tax (MSME, GST GSP), 4D BIM (Autodesk APS), UAN verification (Karza/Signzy), the legal-group external feeds, and diagnostics (`FEATURE_FLAGS`, `SLOW_QUERY_MS`).

---

## 8. Feature → environment matrix

What each capability needs, and what happens with nothing set:

| Capability | Needs | With nothing set |
|---|---|---|
| Sign-in, CRM, finance, most modules | the 3 required secrets + DB migrations | Fully works |
| File uploads / document vault / site photos | `STORAGE_PROVIDER=blob` + `BLOB_READ_WRITE_TOKEN` (or S3_*) | Uploads fail; everything else works |
| AI assistant, bill-reader, GRN scan, briefing | OpenRouter keys (§6) **or** `GEMINI_API_KEY` | Shows "switched off / connect this"; manual entry still works |
| Smarter "Ask Documents" search | `AI_EMBED_MODEL` (needs a direct OpenAI key) | Falls back to keyword search |
| Outbound email (org) | a mail path (§9) | `EMAIL_PROVIDER=console` just logs mail |
| Per-user "send as me" email | run `MIGRATION_v15.71` + `v15.78`, then set it in-app under Email Settings | Falls back to the org mailbox |
| Inbound mail reading | `IMAP_*` (org) or per-user IMAP in-app | Inbox stays empty |
| Mobile/background push notifications | `VAPID_*` keys | In-app notifications still work; no push |
| Instant (not polled) chat/notifications | `REALTIME_PUBLISH_URL` + `NEXT_PUBLIC_REALTIME_SSE_URL` | Calm polling keeps things current |
| WhatsApp send/receive | one of the three WhatsApp gateways (§9) | WhatsApp actions dormant |
| GST 2B reconciliation live pull | `GST_GSP_*` | Manual upload/entry still works |
| 4D BIM model viewer | `APS_*` (Autodesk) | Progress tracking works without the 3D viewer |
| Live UAN (EPF/ESI) verification | `UAN_VERIFY_*` | Manual validation still works |
| Legal feeds (TM-watch, cause-lists, IBBI, e-stamp) | the module-81–90 keys | Modules run on manual entry + computed deadlines |

---

## 9. Optional integrations — how to wire them

**Email out** — pick one `EMAIL_PROVIDER`: `smtp` (set `SMTP_HOST/PORT/USER/PASS`, e.g. Gmail app password on `smtp.gmail.com:465` with `SMTP_SECURE=true`), `resend` (`RESEND_API_KEY`), `ses` (`AWS_SES_REGION` + AWS creds), or `console` (logs only, for testing). Set `EMAIL_FROM`.

**Email in** — Gmail over IMAP: `IMAP_HOST=imap.gmail.com`, `IMAP_PORT=993`, and either reuse the SMTP app password or set `IMAP_USER/IMAP_PASS`. Individual users set their own mailbox under in-app Email Settings (stored encrypted).

**WhatsApp — three interchangeable ways:** (a) **Meta Cloud API** — set `WHATSAPP_TOKEN` (a System User token, never expires), `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_WABA_ID`; for inbound also `WHATSAPP_VERIFY_TOKEN` + `META_APP_SECRET`. (b) **Generic gateway** — `WHATSAPP_WEBHOOK_URL` (+ token) pointing at any endpoint accepting `{ to, message }`. (c) **OpenWA** self-hosted (no Meta approval) — `OPENWA_API_URL` (public), `OPENWA_API_KEY`, `OPENWA_SESSION_ID`.

**Web push** — `npx web-push generate-vapid-keys`, then set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.

**Real-time** — stand up any SSE/pub-sub relay, set `REALTIME_PUBLISH_URL` (+ `REALTIME_PUBLISH_TOKEN`) and the public `NEXT_PUBLIC_REALTIME_SSE_URL`. Without it, polling is the safety net.

**Google Workspace sync** — a service account (`GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_PRIVATE_KEY`) with `GOOGLE_SHEETS_ID` / `GOOGLE_DRIVE_FOLDER_ID`, or the no-Cloud-Console route via a Google Apps Script web app (`GAS_WEBAPP_URL` + `GAS_SECRET`).

**Webhook guards** — `CRON_SECRET`, `INGEST_SECRET`, `TELEPHONY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `IOT_INGEST_SECRET` are secrets you invent and match at the sender; they protect the public endpoints.

---

## 10. Verification

Before and after any deploy, the code is proven green by four gates: `npx tsc --noEmit` (0 type errors), `python3 scripts/verify.py` ("ALL CHECKS PASSED" — includes a check that every Prisma model exists in the bundled init SQL, no dead nav links, no secrets in tracked files), `npx vitest run` (~510 unit tests), and `npx next build` (exit 0).

At runtime, confirm wiring from inside the app: **Admin → AI health** proves the AI keys and model for real; features that need an unset key display a "connect this" hint rather than erroring, so a walk through the Command Center quickly surfaces anything still to configure.

---

## 11. Onboarding users

After the first `SUPER_ADMIN` exists (§4.6): create departments and invite users under Admin; assign roles (`SUPER_ADMIN`, `ADMIN`, `DEPARTMENT_HEAD`, `MANAGER`, `EXECUTIVE`, `EMPLOYEE`, `READ_ONLY`, `GUEST`) — permissions are keyed per role and enforced server-side. Each user can set their own outbound identity and mailbox under Email Settings (needs the §5 migrations). Point users at the Launchpad (Command Center) as the home screen; the Alerts board shows only what needs attention, and ⌘K jumps anywhere.

---

## 12. Ongoing operations

To ship a new version: deploy the new build to Vercel, then run any new `MIGRATION_*.sql` in Neon (ascending order, idempotent). Keep the AI account funded or lean on the free-tier fallback provider. Rotate AI keys freely in Vercel (redeploy after). **Never** rotate `ENCRYPTION_KEY`. Keep your sealed secrets backup private and out of the repo — `scripts/verify.py` fails the build if a secret is ever committed.
