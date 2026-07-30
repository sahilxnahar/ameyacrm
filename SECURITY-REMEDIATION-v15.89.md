# Ameya OS — Security Remediation Batch 2 (v15.89)

Builds on v15.88. **Verified:** Prisma schema valid, full typecheck clean, and a
production `next build` succeeds. This batch closes most of the items that were
deliberately deferred in v15.88.

> **Run `MIGRATION_v15.89_all.sql` in Neon when you deploy this build.** It only
> adds 5 nullable columns (token-expiry) — additive and safe; existing share
> links keep working.

---

## 1. What you must do for v15.89

1. **Run `MIGRATION_v15.89_all.sql`** in Neon (token-expiry columns).
2. **Confirm `APP_URL` is set to your real production URL** (e.g.
   `https://crm.ameyaheights.com`) in Vercel. Passkeys are now pinned to
   `APP_URL` instead of a request header (F-37) — if `APP_URL` is wrong or empty
   in production, passkey sign-in won't bind correctly. (Password login is
   unaffected.)
3. **Optional — turn on mandatory 2FA when ready:** set `ENFORCE_2FA=true` in
   Vercel. Leave it unset for now; when you switch it on, any user past their
   grace window without 2FA is redirected to enrol. Announce it first.

No other action is required — the rest is automatic.

---

## 2. What was fixed in v15.89

- **F-24 — Public links now expire.** New customer/partner portal links and
  floor-plan shares expire in 180 days; payment and vendor links in 90 days.
  Existing links (no expiry recorded) keep working until you regenerate them —
  regenerate to apply an expiry.
- **F-29 — Password-reset tokens hashed at rest.** The database now stores only a
  SHA-256 of the reset token, so a DB/backup/log leak can't be replayed to hijack
  a reset.
- **F-16 — Backups encrypted.** The nightly backup is now AES-256-GCM encrypted
  with your `ENCRYPTION_KEY` and written under a random, non-enumerable object
  name (was plaintext with a predictable date name).
- **F-34 — On-device data cleared at logout.** Queued site notes, attendance
  punches (incl. GPS) and recently-viewed record labels are wiped on sign-out, so
  the next person on a shared/field device can't read them. Theme/density prefs
  are kept.
- **F-37 — Passkey relying-party pinned to `APP_URL`** (see §1.2) and no longer
  derived from a spoofable header.
- **F-21 — Forced password change is enforced.** A user flagged "must change
  password" (temp password / admin reset) is now taken to the change-password
  screen before reaching the app — instead of it being an ignorable banner.
- **F-10 — Mandatory-2FA enforcement is available** behind the `ENFORCE_2FA`
  switch (see §1.3), with the security page exempted so there's no redirect loop.
- **F-13 (rest) — `bookings.csv` export is now hierarchy-scoped** (like leads).
  The finance/audit exports (cash-book, collections, audit) remain org-wide by
  design for their gated finance/admin roles.
- **F-35 / F-36 (partial) — Crypto observability.** A weak/placeholder
  `ENCRYPTION_KEY` now logs a startup warning, and a ciphertext that fails to
  decrypt is logged (possible tamper/key-mismatch).

---

## 3. Still open (needs a dedicated, backed-up migration — do NOT rush)

- **F-35 / F-36 (full) — Rotate the encryption KDF / make `decryptSafe` fail
  closed.** This must be done as a **versioned re-encryption migration with a DB
  backup first**, because changing key derivation or removing the plaintext
  fallback would make existing encrypted secrets (2FA, mailbox passwords)
  unreadable. Plan this as its own maintenance window.
- **F-16 (cloud side)** — confirm the storage bucket is private + server-side
  encrypted + short lifecycle (needs your S3/R2/Vercel console).
- **F-08 (edge)** — move rate limiting to a Redis/edge store independent of the
  app DB (infra change).

---

## 4. Quick post-deploy checks

- Regenerate one customer portal link → the new URL works; confirm a link you
  regenerate carries an expiry (it stops working after the TTL).
- Log out on a field device → `localStorage` no longer holds `ameya-outbox` /
  `ameya.offlinePunches`.
- With `ENFORCE_2FA=true` on a test account past grace → you're sent to enrol 2FA
  and can't skip into the app.
