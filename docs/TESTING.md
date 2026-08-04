# Testing

## Strategy

| Layer | Tooling | What it covers |
|---|---|---|
| Unit | **Vitest** | Pure logic: RBAC expansion, password policy, formatters, ICS builder |
| Type safety | **tsc --noEmit** (strict, `noUncheckedIndexedAccess`) | Whole codebase compiles |
| Lint | **ESLint 8** (`next/core-web-vitals`, `.eslintrc.cjs`) | Bans `as never`, `location.reload()` and raw-unsafe SQL. Runs under a warning ratchet — see below |
| Schema | **prisma validate** | Data model integrity |
| Integration | Prisma against a disposable Postgres (CI service, `LIVE_DB` set) | The money chain: vouchers post, the ledger balances, reversals invert cleanly, and a double-settlement is refused |
| Build | `next build` | Production bundle succeeds |
| Container | `docker build` | Image builds & starts (healthcheck) |

CI (`.github/workflows/ci.yml`) runs lint → typecheck → `prisma db push` → test → build
against an ephemeral `postgres:16` service container, with `LIVE_DB` set so the money-chain
tests actually execute.

### Honest statement of coverage

Until August 2026 none of this was true: `ci.yml` did not exist, the only workflow ran
`npm audit` and `tsc`, and there was no ESLint config at all — `next lint` would have dropped
into an interactive setup prompt. The 612 passing tests were unenforced, and the 25
`LIVE_DB`-gated database tests had never run in CI.

What is still true today:

- **No test imports a `'use server'` action module.** Coverage is pure functions in `src/lib`
  plus a handful of services. The money-moving actions are covered only by the integration
  tests added in the same change, not comprehensively.
- **There is no end-to-end or browser test.** No Playwright, no Cypress.
- **The lint warning cap is a ratchet, not a clean bill.** 148 known violations remain (93
  `as never`, 53 `location.reload()`, 2 hook deps). CI fails if the count rises. Lower the
  `--max-warnings` number in `ci.yml` and `package.json` as batches clear them.

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
