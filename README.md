# Ameya Heights CRM

> Internal CRM & Construction / Real‑Estate ERP‑lite for **Ameya Heights LLP**.
> _Building Spaces. Shaping Legacies._

A production‑grade, multi‑project, multi‑department operating system: tasks & work
assignment, sales/leads (incl. NRI), document control, billing (GST), structured
material‑request emails, marketing (campaigns/social/assets), lease (tenants/rent/
maintenance), architecture (drawings/RFIs/issues), approvals, calendar, reports, audit
trail, RBAC, 2FA — as an installable PWA with an Android wrapper path.

---

## Stack

| Layer | Choice |
|------|--------|
| Framework | **Next.js 15** (App Router, Server Actions, RSC) · React 19 · TypeScript (strict) |
| UI | Tailwind CSS + shadcn‑style components (Radix) · Framer‑ready · Recharts · cmdk |
| Database | **PostgreSQL** via **Prisma** (56 models) |
| Auth | Custom secure sessions · TOTP 2FA · backup codes · device trust · lockout |
| Storage | S3‑compatible (MinIO / AWS S3 / Cloudflare R2) — pluggable, `local` fallback |
| Email | Pluggable: SMTP · SES · Resend · `console` |
| Notifications | In‑app · Web Push (VAPID) · Email |
| PWA | Manifest · service worker · offline · installable (iOS/Android/desktop) |
| Deploy | Docker + Docker Compose · GitHub Actions CI · Vercel + Neon path |

## Quick start (Docker — the free, self‑hostable path)

```bash
cp .env.example .env                      # then set SESSION_SECRET & ENCRYPTION_KEY
openssl rand -base64 48                    # generate each secret
docker compose up -d --build               # app + Postgres + MinIO + Mailpit
# App        → http://localhost:3000
# MinIO UI   → http://localhost:9001  (minioadmin / minioadmin)
# Mailpit    → http://localhost:8025
```

The app container runs migrations on boot and (with `SEED_ON_START=true`) seeds
departments, roles, the Ameya Heights project and demo users.

## Quick start (local dev)

```bash
npm install
cp .env.example .env          # point DATABASE_URL at a local Postgres
npm run prisma:migrate        # create schema
npm run db:seed               # seed baseline data
npm run dev                   # http://localhost:3000
```

### Seeded logins (change immediately)

| Username | Role | Password |
|---|---|---|
| `superadmin` | Super Admin | `Ameya@Heights2026` |
| `itadmin` | Admin | `Ameya@Heights2026` |
| `priya.sales` | Department Head (Sales) | `Ameya@Heights2026` |
| `rahul.mgr` | Manager (Sales) | `Ameya@Heights2026` |

## Documentation

| Doc | Purpose |
|---|---|
| [ARCHITECTURE](docs/ARCHITECTURE.md) | System design, layers, folder structure, data flow |
| [DATABASE](docs/DATABASE.md) | Schema, ER overview, key relations |
| [RBAC_MATRIX](docs/RBAC_MATRIX.md) | Roles × permissions grid |
| [API](docs/API.md) | Server actions & REST/route endpoints |
| [SECURITY](docs/SECURITY.md) | Threat model & OWASP‑Top‑10 controls |
| [INSTALLATION](docs/INSTALLATION.md) | Local, Docker, and free‑hosting installs |
| [ADMIN_GUIDE](docs/ADMIN_GUIDE.md) | Day‑to‑day administration |
| [USER_GUIDE](docs/USER_GUIDE.md) | End‑user walkthrough |
| [MOBILE_PWA](docs/MOBILE_PWA.md) | PWA install + Android APK build |
| [APP_INSTALL_GUIDE](docs/APP_INSTALL_GUIDE.md) | iPhone PWA + Android .apk (no-terminal, PWABuilder) |
| [TESTING](docs/TESTING.md) | Test strategy |
| [BACKUP_RECOVERY](docs/BACKUP_RECOVERY.md) | Backups, restore, disaster recovery |
| [DEPLOYMENT_CHECKLIST](docs/DEPLOYMENT_CHECKLIST.md) | Go‑live checklist |

## Scripts

```bash
npm run dev            # dev server
npm run build          # prisma generate + next build
npm run typecheck      # tsc --noEmit
npm run lint           # eslint
npm test               # vitest
npm run db:seed        # seed data
npm run prisma:studio  # visual DB browser
```

## Branding

All brand tokens (colours, fonts, logo/app‑icon assets) live in
[`src/config/brand.ts`](src/config/brand.ts) and are mirrored as CSS variables in
[`src/app/globals.css`](src/app/globals.css). Re‑skin the whole app by editing those
two files — nothing is hard‑coded in components.

> RERA registration is **in progress**; keep RERA notices as‑is until registered.

## License

Proprietary © Ameya Heights LLP. All rights reserved.
