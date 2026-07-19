# Installation

Three supported paths: **Docker (recommended, free to self‑host)**, **local dev**, and
**Vercel + managed Postgres (zero‑infra free tier)**.

## Prerequisites

- Node.js ≥ 20 (22 recommended) and npm — for local dev.
- Docker + Docker Compose — for the container path.
- A PostgreSQL 14+ database and an S3‑compatible bucket (MinIO/AWS S3/Cloudflare R2).

Generate the two required secrets once:

```bash
openssl rand -base64 48   # SESSION_SECRET
openssl rand -base64 48   # ENCRYPTION_KEY
```

## A) Docker Compose (self‑host, $0)

Brings up app + Postgres + MinIO + Mailpit, runs migrations, and seeds on first boot.

```bash
cp .env.example .env
# set SESSION_SECRET and ENCRYPTION_KEY in .env (or export them)
docker compose up -d --build
```

| Service | URL |
|---|---|
| CRM | http://localhost:3000 |
| MinIO console | http://localhost:9001 (minioadmin / minioadmin) |
| Mailpit (captured email) | http://localhost:8025 |

Sign in with `superadmin` / `Ameya@Heights2026` and change the password immediately.

To disable auto‑seed after first run, set `SEED_ON_START=false` for the `app` service.

## B) Local development

```bash
npm install
cp .env.example .env
# point DATABASE_URL at a local Postgres; STORAGE_PROVIDER=local & EMAIL_PROVIDER=console
# are fine for dev (files land in ./uploads-local, emails print to the console)
npm run prisma:migrate      # apply schema
npm run db:seed             # baseline + demo data
npm run dev                 # http://localhost:3000
```

Useful:

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm test            # vitest
npm run prisma:studio
```

## C) Vercel + Neon/Supabase (free tier)

1. Create a free Postgres (Neon or Supabase) → copy its connection string.
2. Create a bucket on Cloudflare R2 or Supabase Storage (S3‑compatible) → keys/endpoint.
3. Import the repo into Vercel. Set environment variables (from `.env.example`):
   `DATABASE_URL`, `SESSION_SECRET`, `ENCRYPTION_KEY`, `STORAGE_PROVIDER=s3`, `S3_*`,
   `EMAIL_PROVIDER` (`resend` is easiest on Vercel) + `RESEND_API_KEY`, optional `VAPID_*`.
4. Build command is `npm run build` (runs `prisma generate`). After first deploy, run
   migrations once: `npx prisma migrate deploy` (via a Vercel job or locally against the
   prod URL). Seed optionally with `npm run db:seed`.

> Note: long‑running background jobs are limited on serverless; notification fan‑out and
> email send inline today, which is fine at Ameya’s scale. For heavy volume, self‑host (A)
> or add a queue (see ARCHITECTURE → Scalability).

## Environment reference

See [`.env.example`](../.env.example) for every variable with inline guidance:
app URL, `DATABASE_URL`, crypto secrets, session policy, auth policy, `STORAGE_*`,
`EMAIL_*`, and `VAPID_*`.

## Troubleshooting

- **“Invalid environment configuration.”** A required var is missing/short — check
  `SESSION_SECRET`/`ENCRYPTION_KEY` are ≥32 chars and `DATABASE_URL` is a valid URL.
- **Can’t upload files.** With `STORAGE_PROVIDER=s3`, confirm bucket exists and keys are
  set; the Compose `createbucket` service provisions `ameya-crm` automatically for MinIO.
- **No emails.** With `EMAIL_PROVIDER=console`, email is logged, not sent — expected in dev.
- **Push not firing.** Set `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`; the browser must grant
  notification permission and the PWA must be installed/served over HTTPS.
