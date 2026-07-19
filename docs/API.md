# API reference

The app is **API‑first**. Mutations are typed **Server Actions**; integrations and
downloads are **Route Handlers** under `/api`. All are authenticated via the session cookie
and authorized via RBAC.

## Server Actions

Import and call directly from Client Components. Each validates input with Zod, asserts a
permission, writes an audit entry, emits notifications where relevant, and returns either
`{ ok: true, id }` or `{ error: string }` (auth flows redirect instead).

### Auth — `src/server/actions/auth.ts`
| Action | Signature | Notes |
|---|---|---|
| `loginAction` | `(prev, FormData) → ActionState` | password → 2FA or session |
| `verifyTwoFactorAction` | `(prev, FormData) → ActionState` | TOTP or backup code |
| `logoutAction` | `() → void` | revokes session |

### Security — `src/server/actions/security.ts`
`startTwoFactorSetup()` · `confirmTwoFactor(code)` · `disableTwoFactor(password)` ·
`changePassword({current,next})`

### Tasks — `src/server/actions/tasks.ts`
`createTask(input)` · `moveTask(id,status,position)` · `respondToAssignment({taskId,action,reason})`
(`ACCEPT|REJECT|CLARIFY|COMPLETE`) · `addTaskComment(id,body)` · `toggleChecklistItem(id,done)` ·
`updateAssignmentProgress(id,pct)`

### Sales — `src/server/actions/sales.ts`
`createLead(input)` · `moveLeadStage(id,status)` · `logLeadActivity({leadId,type,subject,notes})`

### Documents — `src/server/actions/documents.ts`
`createFolder(input)` · `uploadDocument(FormData)` — stores object, creates FileObject +
Document + first version.

### Billing — `src/server/actions/billing.ts`
`createInvoice(input)` — computes subtotal, CGST/SGST or IGST, total.

### Material requests — `src/server/actions/material.ts`
`createMaterialRequest(input)` — creates request + items, renders the email template, opens
an approval workflow, sends the email. · `decideMaterialRequest(id,'APPROVED'|'REJECTED',comment?)`

### Admin — `src/server/actions/admin.ts`
`createUser(input)` · `setUserStatus(id,status)` · `forcePasswordReset(id)` · `createDepartment(input)`

## Route Handlers (`/api`)

| Method & Path | Auth | Purpose |
|---|---|---|
| `GET /api/health` | public | Liveness + DB check (used by Docker healthcheck) |
| `GET /api/notifications` | session | Latest 15 notifications + unread count |
| `POST /api/notifications` | session | Mark all read |
| `GET /api/files/{id}` | `document.download` | Audited download; streams local or 302 to signed S3 URL |
| `GET /api/calendar/ics` | session | ICS feed of the user’s events |
| `GET /api/push/subscribe` | public | Returns VAPID public key |
| `POST /api/push/subscribe` | session | Register a web‑push subscription |
| `GET /api/reports/tasks.csv` | `report.export` | Tasks export (CSV) |
| `GET /api/reports/audit.csv` | `audit.export` | Audit export (CSV) |

## Conventions

- **Errors:** actions never leak internals — `toActionError()` maps thrown
  `ForbiddenError`/`AuthError`/`ZodError` to safe messages.
- **Idempotency & audit:** state‑changing routes and actions write `AuditLog` entries with
  actor, IP and summary.
- **Reuse for future clients:** because business logic lives in actions/services, a future
  native app or partner integration can expose these same operations as REST/GraphQL with a
  thin adapter — no domain rewrite.
