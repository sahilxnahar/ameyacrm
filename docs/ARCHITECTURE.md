# Architecture

Ameya Heights CRM is a modular monolith built on Next.js 15 (App Router). It favours
clarity and operability over microservice sprawl, while keeping clean seams so modules
and future services can be extracted without a rewrite.

## Principles

- **API‑first, server‑centric.** Mutations run through typed **Server Actions**;
  cross‑system integrations use **Route Handlers** under `/api`. UI never talks to the
  database directly.
- **Clean layering.** `UI → Server Actions/Route Handlers → Services → Prisma → Postgres`.
  Domain/business logic lives in `src/server/services` and `src/lib/*`, not in components.
- **Secure by default.** Every mutation resolves an auth context and asserts a
  permission; every sensitive action writes an audit record.
- **Multi‑tenant‑ready within one org.** First‑class **Project** and **Department**
  scoping is in the schema from day one, so 1 → 10+ projects needs no migration of shape.
- **Pluggable infrastructure.** Storage and email are interfaces with multiple adapters,
  selected by environment — no vendor lock‑in.

## Layered view

```
┌──────────────────────────────────────────────────────────────┐
│ Client (React 19 RSC + Client Components, PWA shell)          │
│  · App shell, command palette, Kanban, dialogs, charts        │
│  · Service worker (offline, web‑push)                         │
└───────────────┬──────────────────────────────────────────────┘
                │  Server Actions ("use server")  +  /api routes
┌───────────────▼──────────────────────────────────────────────┐
│ Application layer                                             │
│  src/server/actions/*      → validated (Zod) mutations        │
│  src/server/services/*     → query/composition logic          │
│  src/lib/auth, rbac, audit, notifications, storage, email     │
└───────────────┬──────────────────────────────────────────────┘
                │  Prisma Client
┌───────────────▼──────────────────────────────────────────────┐
│ Data layer — PostgreSQL (56 models, indexed, FK‑constrained)  │
└──────────────────────────────────────────────────────────────┘
        │              │                 │
   S3 storage      SMTP/SES/Resend    Web Push (VAPID)
```

## Request lifecycle (a mutation)

1. A Client Component calls a Server Action (e.g. `createTask`).
2. The action validates input with **Zod**.
3. `ensure('task.create')` resolves the session → user → **permission set** and authorizes.
4. The service writes via Prisma inside a transaction where needed.
5. An **audit** entry and any **notifications** (in‑app / push / email) are emitted.
6. `revalidatePath()` refreshes affected server components; the client shows a toast.

## Authentication & session model

- Opaque session tokens; only the **SHA‑256 hash** is stored (`Session.tokenHash`).
- Cookie is `httpOnly`, `secure` (prod), `sameSite=lax`.
- Absolute TTL **and** idle timeout are both enforced on every read.
- Password → **2FA ticket** (short‑lived signed JWT) → TOTP/backup‑code → full session.
- Failed attempts increment a counter and trigger **lockout**; every attempt is recorded
  in `LoginHistory` with IP/user‑agent.

See [SECURITY.md](SECURITY.md) for the full control set.

## RBAC

Eight roles (`SUPER_ADMIN … GUEST`) each map to a set of `module.action` permissions.
Defaults live in code (`src/lib/rbac/roles.ts`) and are seeded into `RolePermission`, so
admins can re‑map them at runtime. Per‑user grants/denies live in `UserPermission`
(DENY wins). `SUPER_ADMIN` short‑circuits to allow‑all. See [RBAC_MATRIX.md](RBAC_MATRIX.md).

## Modules

Tasks & Work Assignment · Sales/Leads/NRI/Bookings · Document Control · Billing (Invoices/
PO/Vendor Bills, GST) · Material Requests + structured email · **Marketing** (campaigns,
budget/spend, social calendar, asset library) · **Lease** (tenants, leases, auto rent
schedule, maintenance) · **Architecture** (drawings + revisions, RFIs, consultants, issue
logs) · Approvals (shared workflow) · Calendar (+ICS) · Notifications · Reports · Admin ·
Audit. Each module is a slice of `app/(app)/<module>` (routes) + `server/actions/<module>`
+ `components/<module>`.

## Folder structure

```
ameya-heights-crm/
├─ prisma/
│  ├─ schema.prisma          # 56 models, 25 enums
│  └─ seed.ts                # departments, RBAC, project, demo users
├─ src/
│  ├─ app/
│  │  ├─ (auth)/             # login, two-factor
│  │  ├─ (app)/              # authenticated shell + all module pages
│  │  ├─ api/                # health, notifications, files, push, calendar/ics, reports
│  │  ├─ forbidden/          # 403
│  │  ├─ layout.tsx          # fonts, theme, PWA metadata
│  │  └─ globals.css         # brand design tokens (light/dark)
│  ├─ components/            # ui/, layout/, tasks/, sales/, documents/, billing/, admin/, settings/, reports/, pwa/
│  ├─ config/               # brand.ts, env.ts, navigation.ts
│  ├─ lib/                  # auth/, rbac/, db/, storage/, email/, notifications/, audit/, calendar/, utils/
│  ├─ server/
│  │  ├─ actions/           # server actions (mutations) per module
│  │  └─ services/          # query/composition services
│  └─ types/
├─ docs/                    # this documentation set
├─ tests/                   # vitest unit tests
├─ Dockerfile · docker-compose.yml · docker-entrypoint.sh
├─ .github/workflows/ci.yml
└─ public/                  # brand assets, PWA icons, sw.js, manifest, offline.html
```

## Scalability path

- **Read scaling:** Postgres read replicas; Prisma supports a separate read URL.
- **Files:** already externalized to S3 — scales to millions of objects; add CDN in front.
- **Background work:** notification fan‑out and email are async today; extract to a queue
  (BullMQ/SQS) when volume grows — the `notify()`/`sendEmail()` interfaces stay identical.
- **Sessions/rate‑limit:** move from in‑memory/DB to Redis for horizontal scale.
- **Future clients:** the same Server Actions + `/api` back a future native app, client
  portal, vendor portal, WhatsApp bot and AI assistant with no schema change.
