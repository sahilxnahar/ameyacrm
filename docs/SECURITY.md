# Security

Built to protect financial‑grade data. This document maps controls to the OWASP Top 10 and
describes the account‑security model.

## Authentication

- **Password hashing:** bcrypt (cost 12). Interface isolated in `src/lib/auth/password.ts`
  so Argon2id is a one‑file swap. Policy: ≥12 chars, upper+lower+number+symbol.
- **Password history:** last 5 hashes retained; reuse blocked. Configurable **expiry**
  (`PASSWORD_EXPIRY_DAYS`) → forces change at next login.
- **Two‑factor (TOTP):** RFC‑6238 via `otplib`. The secret is **AES‑256‑GCM encrypted**
  at rest (`ENCRYPTION_KEY`). Enrolment shows a QR; 10 one‑time **backup codes** are issued
  (bcrypt‑hashed, single‑use).
- **Two‑step login:** password → short‑lived signed **MFA ticket** (5 min JWT) → TOTP or
  backup code → full session. Optional **device trust** (30 days) via hashed device cookie.
- **Account lockout:** after `MAX_FAILED_LOGINS` (default 5), lock for `LOCKOUT_MINUTES`.
- **Login history:** every attempt (success/failure, reason, IP, user‑agent) recorded.
- **Admin controls:** force password reset, disable/suspend user (revokes all sessions).

## Sessions

- Opaque 256‑bit token; only its **SHA‑256 hash** is stored. Cookie is `httpOnly`,
  `secure` (prod), `sameSite=lax`.
- **Absolute TTL** (`SESSION_TTL_HOURS`) **and idle timeout** (`SESSION_IDLE_TIMEOUT_MINUTES`)
  are enforced on every request; expired/idle sessions are revoked server‑side.
- Users can view active sessions and recent logins in Settings → Security.

## OWASP Top 10 coverage

| Risk | Control |
|---|---|
| A01 Broken Access Control | Central RBAC (`ensure` / `requirePermission` / `can`) on every action, page and route; DENY‑wins overrides; nav is not the boundary |
| A02 Cryptographic Failures | bcrypt passwords; AES‑256‑GCM for TOTP secrets; hashed session/device/backup tokens; secrets from env only |
| A03 Injection | Prisma parameterized queries (no raw SQL in app paths); **Zod** validation on all inputs |
| A04 Insecure Design | Least‑privilege roles, approval workflows, immutable audit log, threat‑modelled auth |
| A05 Security Misconfiguration | Strict security headers + CSP (see `next.config.mjs`); `poweredByHeader:false`; validated env fails fast |
| A06 Vulnerable Components | Pinned dependencies; CI build gate; `npm audit` in pipeline |
| A07 Auth Failures | 2FA, lockout, session idle/absolute expiry, generic error messages (no user enumeration) |
| A08 Integrity Failures | Signed MFA ticket (JWT); file checksums (SHA‑256); server‑only mutation surface |
| A09 Logging & Monitoring | Comprehensive `AuditLog` (login, CRUD, approve, upload, download, role/permission/password changes, exports) with actor+IP; `/api/health` |
| A10 SSRF | No user‑controlled outbound fetches; storage/email endpoints are server‑configured only |

## HTTP hardening (`next.config.mjs`)

`Strict-Transport-Security`, `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, and a restrictive
**Content-Security-Policy**. Cookies are `httpOnly`/`secure`/`sameSite`.

## Secrets

All secrets come from the environment and are validated at boot (`src/config/env.ts`):
`SESSION_SECRET`, `ENCRYPTION_KEY` (≥32 chars each), DB URL, storage/email creds, VAPID keys.
Nothing sensitive is committed; `.env` is git‑ignored; build‑time placeholders are never
shipped in the image.

```bash
openssl rand -base64 48   # SESSION_SECRET
openssl rand -base64 48   # ENCRYPTION_KEY
npx web-push generate-vapid-keys   # push keys
```

## Data protection & privacy

- File downloads are permission‑checked and **audited** (who/when/what).
- TOTP secrets encrypted; passwords/back‑up codes hashed; session tokens hashed.
- Least‑privilege DB user recommended in production; enable TLS to Postgres.
- DPDPA/GDPR‑friendly: audit trail supports access reporting; soft‑deletes support review.

## Responsible disclosure

Report vulnerabilities to security@ameyaheights.com. Do not open public issues for security
matters.
