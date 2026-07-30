# Ameya OS v15.90 — Post-Remediation Audit + Hardening Checklist

**Verified:** typecheck clean, production build green, and the Next.js
vulnerability warning you saw on deploy is **gone** (framework patched).

This build was produced by (a) re-auditing v15.89 adversarially — trying to
*bypass* the fixes — and (b) closing every real gap that pass found, plus the
new framework CVE.

---

## 1. What the audit found in v15.89 (and is now fixed in v15.90)

The remediation was broad, but an adversarial pass found that several fixes had
been applied on one code path while a *sibling* path kept the old behaviour.
All are now closed:

| # | Issue found | Severity | Fixed |
|---|---|---|---|
| CVE | **Next.js 15.5.4 had a new CVE (CVE-2025-66478)** — the warning on your deploy | High | Upgraded to **15.5.22** (latest patched 15.5.x) |
| 1 | SSRF filter bypass via IPv4-mapped IPv6 (`::ffff:7f00:1` → 127.0.0.1, `::ffff:a9fe:a9fe` → cloud metadata) | High | Mapped-IPv6 + NAT64 now decoded and blocked |
| 2 | Outbound webhooks still **followed redirects** → SSRF into internal hosts via a 302 | High | Webhook delivery no longer follows redirects |
| 3 | **Privilege escalation** — `approveAccessRequest` could set any role (an ADMIN could approve a SUPER_ADMIN), bypassing the createUser gate | High | Now role-hierarchy checked (`canAssignRole`) |
| 4 | Portal/pay **token expiry** was enforced on the page but **not** in the underlying server actions (submit snag, register lead, confirm payment) | High | Expiry now enforced in the actions too |
| 5 | `v1/consent` API accepted **writes from a read-only token** (could flip lead consent) | Medium | Write-scope now required |
| 6 | Restricted-folder documents could be reached via **single-document actions** (move/rename/summarise/send-to-Drive) that skipped the folder ACL | High | Folder ACL now enforced on every document action |
| 7 | Ingest endpoints still accepted the secret in `?key=` (log leakage) and used non-constant-time compare | Medium | All ingest routes now header-only + constant-time |
| 8 | File download could reach a document in a **soft-deleted restricted folder** | Low | Deleted/unknown folders now deny |

**Net:** the app-code attack surface from the original 38-finding audit plus these
8 bypasses is now closed. What remains is **operational/config** (your action) and
one **deferred crypto-rotation** task (needs a backup + maintenance window).

---

## 2. What YOU must do so nobody can get in — the checklist

Security is code **plus** configuration. The code is done; these are the settings
only you can apply. Do them in order.

### A. Secrets (set every one — endpoints now fail closed without them)
In Vercel → Settings → Environment Variables (generate each with `openssl rand -base64 32`):
- `CRON_SECRET` — or your nightly jobs (reminders, backups, retention) stay off.
- `SETUP_SECRET`, `INGEST_SECRET`, `IOT_INGEST_SECRET`, `TELEPHONY_SECRET`.
- `ENCRYPTION_KEY` — **must be a 32-byte random value, set once, never changed.**
- `SESSION_SECRET` — 32-byte random.
- `APP_URL` — your real URL `https://crm.ameyaheights.com` (passkeys bind to it).

### B. Database (run in Neon)
- Run **`MIGRATION_v15.89_all.sql`** if you haven't (the token-expiry columns).
  *(v15.90 needs no new migration.)*
- Confirm the DB role is least-privilege and TLS is enforced (Neon defaults are fine).
- Turn on Neon **PITR / backups**.

### C. Object storage (S3 / R2 / Vercel Blob)
- Bucket is **private** (no public list/read).
- **Server-side encryption** on.
- Short lifecycle on the `backups/` prefix. *(Backups are now encrypted by the app too.)*

### D. Turn on the stronger controls
- Set `ENFORCE_2FA=true` once you've told staff to enrol — then 2FA is mandatory.
- Populate the **manager hierarchy** (`managerId`) so lead/booking scoping is correct.
- Keep WhatsApp off (default) until you have the Meta secret.

### E. People & process (this is how most breaches actually happen)
- Every user on a **strong, unique password + 2FA**. Admins first.
- Remove the default/seed admin; give each admin their own account.
- Review the **Admin → Permissions** and **finance-access** lists — least privilege.
- Rotate any secret that was ever put in a URL/log historically.
- Enable Vercel's **deployment protection** and log retention; watch the audit log.

### F. Ongoing
- The CI security workflow (added in v15.88) runs `npm audit` — act on High/Critical.
- Re-run the framework upgrade when the next Next.js patch ships (you just saw why).
- Plan the **F-35/F-36 encryption-key rotation** as its own backed-up maintenance
  window (changing it without a re-encryption migration would make existing 2FA /
  mailbox secrets unreadable — do NOT rush it).

---

## 3. Honest bottom line

No system is "unhackable," and anyone who promises that is lying. But after v15.90:
- The **code-level** ways in (injection, SSRF, privilege escalation, IDOR, fail-open
  endpoints, unpatched framework) that the audit found are **closed and verified**.
- Your **data is encrypted** at rest for the sensitive secrets, and backups are now
  encrypted too.
- The remaining risk is **configuration and human** — the checklist in §2. Do those
  and you've shut the doors that real attackers actually use.

The single highest-leverage things: **set the secrets (§A), enforce 2FA (§D), and
keep every admin on 2FA (§E).** Most break-ins are a stolen password, not clever code.
