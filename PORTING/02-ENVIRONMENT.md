# 2 — Environment variables

Every setting the CRM reads, what it does, and what happens without it.

Set these in **Vercel → Settings → Environment Variables**, or in a `.env` file
if you self-host.

---

## Required — the app will not start without these

| Variable | What it is | How to get it |
|---|---|---|
| `DATABASE_URL` | Pooled Postgres connection | Neon dashboard |
| `DATABASE_URL_UNPOOLED` | Direct connection, for migrations | Neon dashboard |
| `SESSION_SECRET` | Signs login sessions. **32+ characters** | `openssl rand -base64 48` |
| `ENCRYPTION_KEY` | Encrypts stored credentials. **32+ characters** | `openssl rand -base64 32` |

> **Changing `SESSION_SECRET` signs everybody out.** That is the correct
> emergency response if you believe it has leaked.
>
> **Do not change `ENCRYPTION_KEY` once data exists.** Anything encrypted with
> the old key becomes unreadable. There is no recovery.

## Strongly recommended

| Variable | Without it | How to get it |
|---|---|---|
| `APP_URL` | Emails contain broken links | Your live URL, e.g. `https://crm.ameyaheights.com` |
| `CRON_SECRET` | Scheduled jobs refuse to run — no overdue flagging, no demand letters | `openssl rand -base64 32` |
| `RESEND_API_KEY` | No email at all: no invites, no password resets | resend.com |

## Optional — each unlocks one feature

Every one of these is **off until set**, and the endpoint it guards returns
`503 Not configured` rather than running unprotected. That is deliberate: a
half-configured integration should refuse to work, not work insecurely.

| Variable | Unlocks |
|---|---|
| `TALLY_BRIDGE_SECRET` | Live Tally sync (`tools/tally-bridge/`) |
| `RAZORPAY_WEBHOOK_SECRET` | Automatic payment reconciliation |
| `GEMINI_API_KEY` | AI document summaries and the assistant |
| `INGEST_SECRET` | Public lead-capture webhook (website forms) |
| `TELEPHONY_SECRET` | Call-recording webhook |
| `IOT_INGEST_SECRET` | Site sensor / gate feed |
| `WHATSAPP_*` | WhatsApp messaging |
| `S3_*` / `BLOB_READ_WRITE_TOKEN` | File storage (defaults to Vercel Blob) |
| `ESTAMP_*` | e-stamping through SHCIL |
| `GST_GSP_*` | GST return filing through a GSP |

Anything not listed here is for a specialist module and can be ignored until you
turn that module on. **Settings → Integrations** in the app shows the live state
of each one.

---

## Generating secrets

```bash
openssl rand -base64 48   # SESSION_SECRET
openssl rand -base64 32   # everything else
```

No OpenSSL (Windows without WSL):

```powershell
node -e "console.log(require('crypto').randomBytes(36).toString('base64'))"
```

## Rules worth following

1. **Never commit secrets to git.** `.env` is git-ignored; keep it that way.
2. **Use different secrets for preview and production.** Vercel lets you scope
   a variable per environment — a leaked preview key should not touch live data.
3. **A shared secret belongs in a header, never a URL.** Query strings end up in
   server logs, browser history and referrer headers. Every machine endpoint in
   this codebase reads its secret from a header for that reason.
4. **Rotating a webhook secret means updating both ends** — here and at the
   provider. Until both match, that webhook fails closed.
