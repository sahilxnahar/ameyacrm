# Testing

## Strategy

| Layer | Tooling | What it covers |
|---|---|---|
| Unit | **Vitest** | Pure logic: RBAC expansion, password policy, formatters, ICS builder |
| Type safety | **tsc --noEmit** (strict, `noUncheckedIndexedAccess`) | Whole codebase compiles |
| Lint | **ESLint** (`next/core-web-vitals`, `next/typescript`) | Style & correctness |
| Schema | **prisma validate** | Data model integrity |
| Integration | Prisma against a disposable Postgres (CI service) | Migrations apply; queries run |
| Build | `next build` | Production bundle succeeds |
| Container | `docker build` | Image builds & starts (healthcheck) |

CI (`.github/workflows/ci.yml`) runs lint → typecheck → test → build against an ephemeral
Postgres, then builds the Docker image.

## Running locally

```bash
npm test            # vitest (unit)
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run build       # prisma generate + next build
npx prisma validate # schema
```

## Included unit tests (`tests/`)

- `rbac.test.ts` — wildcard/module expansion, role default guarantees.
- `password.test.ts` — strength policy accept/reject.
- `ics.test.ts` — valid VCALENDAR output.
- `format.test.ts` — initials, enum title‑casing, INR formatting.

Server‑only modules are unit‑tested by aliasing `server-only` to a stub in
`vitest.config.ts`, so pure helpers run in node without the RSC guard.

## Extending

- **Integration:** point `DATABASE_URL` at a throwaway Postgres, run `prisma migrate deploy`,
  and exercise services (`src/server/services/*`) with seeded data.
- **E2E (recommended next):** add Playwright to cover login → 2FA → create task → approve
  material request. Keep fixtures in a dedicated schema and reset between runs.
- **Load/security:** run `npm audit` in CI (already gated by the build job); add k6/Artillery
  for capacity testing before large rollouts.

## Definition of done for a change

Lint clean · types clean · unit tests pass · migration committed (if schema changed) ·
`next build` succeeds · audit/notification side effects verified for new mutations.
