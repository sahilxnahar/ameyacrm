# Deployment Checklist

## Pre‑deploy

- [ ] `SESSION_SECRET` and `ENCRYPTION_KEY` are unique, ≥32 chars, from a secret manager
      (not the examples). `ENCRYPTION_KEY` is backed up out‑of‑band.
- [ ] `DATABASE_URL` points at production Postgres (TLS on; least‑privilege DB user).
- [ ] `STORAGE_PROVIDER=s3` with a real bucket + scoped keys; CORS/private ACL set.
- [ ] `EMAIL_PROVIDER` configured (SES/Resend/SMTP) and `EMAIL_FROM` verified/domain‑authed.
- [ ] `VAPID_*` set if push is enabled; `APP_URL` = the public HTTPS URL.
- [ ] Auth policy reviewed: `MAX_FAILED_LOGINS`, `LOCKOUT_MINUTES`, `PASSWORD_EXPIRY_DAYS`,
      `SESSION_TTL_HOURS`, `SESSION_IDLE_TIMEOUT_MINUTES`.
- [ ] `npm run lint && npm run typecheck && npm test && npm run build` all green (CI gate).
- [ ] `npx prisma validate` passes; new migration reviewed and committed.

## Deploy

- [ ] Take a fresh **DB backup** before migrating.
- [ ] `prisma migrate deploy` (the Docker entrypoint does this automatically).
- [ ] Roll out the new image/build; keep the previous tag for rollback.
- [ ] Seed only on the very first deploy (`SEED_ON_START=true` once, then false).

## Post‑deploy smoke test

- [ ] `GET /api/health` → `{ status: "ok" }`.
- [ ] Login works; **2FA** enrol + verify works; forced password change works.
- [ ] Create a task, drag it across the board, comment with an `@mention` (notification fires).
- [ ] Upload a document and download it (download appears in **Audit**).
- [ ] Raise a material request → email generated (check provider/Mailpit) → approve it.
- [ ] Create an invoice; GST totals compute.
- [ ] Reports render; CSV export downloads; `/audit` shows recent actions.
- [ ] PWA installs; offline page shows when disconnected.

## Security & ops

- [ ] HTTPS enforced end‑to‑end; security headers/CSP present (verify response headers).
- [ ] Secrets not in logs or image layers; `.env` not committed.
- [ ] Backups scheduled and a **test restore** completed.
- [ ] Uptime + error monitoring wired to `/api/health` and app logs.
- [ ] Demo/seed users rotated or disabled; real admins created with 2FA.
- [ ] RERA notices intact until registration completes.

## Rollback

- [ ] Redeploy previous image tag.
- [ ] If a migration must be undone, restore the pre‑deploy DB backup (migrations are
      forward‑only; prefer restore over ad‑hoc down‑migrations in production).
