# Ameya OS — Security Remediation (v15.88)

This build hardens the platform against the findings in the v15.80/v15.87 Master
Security Audit. It is a **code + config** release. **Verified:** full TypeScript
typecheck passes and a production `next build` succeeds on the upgraded framework.

> **No database migration is required for v15.88** — no schema changes were made.

---

## 1. Your setup, in plain terms

- **App:** Next.js (now **15.5.4**), TypeScript, Prisma, PostgreSQL (Neon).
- **Hosting:** Vercel (primary) + a Docker/Compose option for self-hosting.
- **How config works:** secrets live in **environment variables** (Vercel →
  Project → Settings → Environment Variables, or your `.env` for Docker).
- **How DB changes ship:** as manual `MIGRATION_*.sql` files you run in Neon.
  (v15.88 has none.)

The core security theme of this release: **everything now fails *closed*.** Before,
several machine endpoints were wide open whenever their secret wasn't set — and
those secrets were optional, so "open" was the default. Now, if a secret is
missing, the endpoint returns `503 (disabled)` instead of trusting the caller.

**This means you MUST set the secrets below, or the corresponding features stay
off.** That is the intended, safe behaviour.

---

## 2. What YOU must do (action checklist)

### 2.1 Set these environment variables in Vercel (production)

| Variable | Why | How to generate |
|---|---|---|
| `CRON_SECRET` | Cron/backup endpoints are now closed until this is set. Vercel Cron sends it automatically as a Bearer token. | `openssl rand -base64 32` |
| `SETUP_SECRET` | Guards `/api/setup` after first-run (now header-only, no query string). | `openssl rand -base64 24` |
| `INGEST_SECRET` | Email/lead/attachment ingest endpoints. | `openssl rand -base64 24` |
| `IOT_INGEST_SECRET` | IoT sensor ingest (only if you use it). | `openssl rand -base64 24` |
| `TELEPHONY_SECRET` | Call webhook (only if you use telephony). | `openssl rand -base64 24` |
| `ENCRYPTION_KEY` | **Must already be set and NEVER changed.** Confirm it is a 32-byte random value, not a passphrase. | `openssl rand -base64 32` (only if not already set) |

> After setting `CRON_SECRET`, your Vercel cron jobs keep working automatically —
> Vercel signs cron calls with it. Manual calls now need
> `Authorization: Bearer <secret>` (the old `?key=` query form is removed).

### 2.2 WhatsApp — kept OFF for now (as you asked)

The inbound WhatsApp webhook is **disabled by default** and also fails closed on
signature. It stays off until BOTH are true:

1. `WHATSAPP_ENABLED=true`, **and**
2. `META_APP_SECRET=<your Meta app secret>` is set.

Until then `/api/webhooks/whatsapp` returns `503`. **You don't need to do
anything** to keep it disabled. When you get WhatsApp/Cloud API access later, set
those two variables and it turns on — no code change.

### 2.3 Deploy

1. Push this build to GitHub → Vercel builds automatically (it already builds
   clean here).
2. Set the env vars from §2.1.
3. That's it — no SQL to run for v15.88.

### 2.4 One-time hygiene

- Rotate any secret that was previously passed in a URL (`?key=`, `?secret=`) —
  those may sit in old logs.
- In Neon/S3/Vercel, confirm the backup bucket is **private** (see §4).

---

## 3. What was fixed in v15.88 (verified in code)

**Critical / High**
- **F-01** Framework upgraded **15.1.11 → 15.5.4** (closes the CVE-2025-29927
  middleware-bypass class). Build verified.
- **F-02 / F-28** SSRF blocked — the marketing page-fetcher and outbound webhooks
  now reject private/loopback/link-local/metadata addresses and don't follow
  redirects into internal hosts.
- **F-03** All 7 cron/backup endpoints **fail closed**, Bearer-header only,
  constant-time compare.
- **F-04** Email-attachment ingest **fails closed** (was the one fail-open ingest
  route).
- **F-05** `createUser` now enforces role hierarchy — an ADMIN can no longer mint
  a SUPER_ADMIN.
- **F-06** 2FA verification is now rate-limited and one-time codes use a CSPRNG.
- **F-07** WhatsApp webhook fails closed + master kill-switch (see §2.2).
- **F-08** Rate limiter **fails closed for auth** buckets (login/2FA) instead of
  silently disabling under DB pressure.
- **F-09** API v1 tokens now enforce scope — a read-only token can no longer write
  or delete.

**Medium**
- **F-11** `next/image` is no longer an open proxy (restricted to your storage +
  avatar hosts).
- **F-12** Lead mutations + `logLeadActivity` now enforce hierarchy scope (no more
  editing any lead by ID).
- **F-13** The **leads** CSV export is now hierarchy-scoped.
- **F-14** File download enforces folder/ownership access (not just the global
  permission).
- **F-15** Docker entrypoint fails closed on a failed migration (no drifted-schema
  boot).
- **F-17** Added a CI security workflow (`npm audit` fail-on-high + typecheck).
- **F-18** CSV formula-injection neutralised in all exports.
- **F-19** CSP no longer allows `'unsafe-eval'`.
- **F-22** Login no longer leaks the exact account-lockout time.
- **F-23** Minimum password length raised to 12.
- **F-25** The zero-permission GUEST/preview role can't mint upload tokens; chat
  upload cap tightened.
- **F-26** Server actions / APIs / error page no longer leak raw DB/exception text.
- **F-27** DPDP erasure now also scrubs social-activity messages.
- **F-30** Changing your password now revokes all your other sessions.
- **F-31** Telephony webhook is header-only + constant-time.
- **F-32** IoT ingest validates the project (no cross-project poisoning) + header-only.
- **F-38** Console email transport no longer logs bodies/reset-links/OTPs.

---

## 4. What remains — and why (deferred deliberately)

These were **not** changed in v15.88 because doing so safely needs either your
cloud console or a data-migration, and a careless change would corrupt data or
lock users out. Recommended as the next patch:

| Ref | Item | Why deferred / how to do it safely |
|---|---|---|
| **F-35 / F-36** | Encryption KDF hardening + `decryptSafe` fail-closed | **Do NOT flip casually.** Changing key derivation makes all existing encrypted data (2FA secrets, mailbox passwords) unreadable. Needs a re-encryption migration first. |
| **F-10 / F-21** | Hard-enforce 2FA & forced-password-change at login | Login-flow change; must be tested to avoid redirect loops (login already broke once from a rushed change). Recommend a feature flag + staging test. |
| **F-24** | Expiry/rotation on portal & pay links | Needs an additive schema migration + touching 5 token flows. Straightforward next patch. |
| **F-29** | Hash password-reset/verify tokens at rest | Reset-flow change; low-risk but wants a test pass. |
| **F-13 (rest)** | Scope the other CSV exports (bookings, collections, cash-book, tasks, audit) | Same pattern as leads.csv; each needs its domain's scope filter. |
| **F-16** | Encrypt backups + confirm bucket is private/SSE | Needs Neon/S3/Vercel console access — can't verify from code. |
| **F-34** | Clear on-device storage on logout | Client-side; low severity. |

Cloud-side items to confirm in your consoles: Neon role least-privilege + TLS +
PITR; S3/R2/Blob backup bucket private + encrypted; Vercel env scoping.

---

## 5. Quick verification you can run after deploy

- `curl -i https://<app>/api/cron/backup` → expect **503** (not 200) until
  `CRON_SECRET` is set; with `-H "Authorization: Bearer $CRON_SECRET"` → 200.
- `curl -i https://<app>/api/webhooks/whatsapp -X POST` → expect **503** (disabled).
- Sign in on two browsers, change your password on one → the other is logged out.
- As a non-admin, try to export leads.csv → only your scoped rows appear.
