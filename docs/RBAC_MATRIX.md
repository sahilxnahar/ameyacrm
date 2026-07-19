# RBAC Matrix

True role‑based access control. Permissions are `module.action` strings defined in
[`src/lib/rbac/permissions.ts`](../src/lib/rbac/permissions.ts). Role defaults live in
[`src/lib/rbac/roles.ts`](../src/lib/rbac/roles.ts) and are **seeded into the database**
(`RolePermission`) so an admin can re‑map any permission at runtime. Per‑user overrides
live in `UserPermission` (a **DENY always wins**). `SUPER_ADMIN` is allow‑all.

Resolution order (see `resolvePermissions()`):

```
SUPER_ADMIN → all
else: RolePermission(ALLOW) − RolePermission(DENY)
      then + UserPermission(ALLOW) − UserPermission(DENY)
```

## Roles

| Role | Rank | Intent |
|---|---|---|
| Super Admin | 100 | Unrestricted; break‑glass owner |
| Admin | 90 | Full operations + configuration, minus break‑glass |
| Department Head | 70 | Owns a department’s work, docs, approvals, reports |
| Manager | 60 | Creates & assigns work, manages leads/bookings, approves material |
| Executive | 40 | Operates tasks/leads/docs; raises material requests |
| Employee | 30 | Works assigned tasks, views docs, raises material requests |
| Read Only | 20 | Read access across modules |
| Guest | 10 | Minimal: dashboard, task view, calendar |

## Capability grid

Legend: ✓ = allowed by default · ◑ = partial (view/limited) · — = none.
(V=view, C=create, U=update, D=delete, A=approve/manage, X=export)

| Module | Super | Admin | Dept Head | Manager | Executive | Employee | Read Only | Guest |
|---|---|---|---|---|---|---|---|---|
| Dashboard | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Tasks | ✓ | ✓ (CRUD+assign) | ✓ (CRUD+assign) | C U assign | C U | U (own) | V | V |
| Sales / Leads | ✓ | ✓ | V U | C U assign | C U | — | V | — |
| Bookings | ✓ | ✓ | V | V + manage | V | — | V | — |
| Documents | ✓ | ✓ | ✓ (CRUD+perm) | V C U + download | V C U + download | V + download | V | — |
| Billing | ✓ | ✓ (invoice/PO/bill + approve) | V + approve | V | — | — | V | — |
| Material Requests | ✓ | ✓ (+approve) | ✓ (+approve) | C + approve | C | C | V | — |
| Email (send/templates) | ✓ | ✓ | send | send | send | — | — | — |
| Calendar | ✓ | ✓ | ✓ | ✓ | V + manage | V | V | V |
| Reports | ✓ | ✓ V X | V X | V X | V | — | V | — |
| Marketing | ✓ | ✓ (+approve) | ✓ (+approve) | V + manage | V + manage | V | V | — |
| Lease | ✓ | ✓ (CRUD) | V + manage | V + manage | V | V | V | — |
| Architecture (drawings/RFI/issues) | ✓ | ✓ (CRUD) | V + manage | V + manage | V + manage | V | V | — |
| Admin · Users | ✓ | ✓ manage | V | — | — | — | — | — |
| Admin · Departments | ✓ | ✓ | — | — | — | — | — | — |
| Admin · Roles/Perms | ✓ | ✓ | — | — | — | — | — | — |
| Admin · Projects | ✓ | ✓ | — | — | — | — | — | — |
| Admin · Settings/Branding | ✓ | ✓ | — | — | — | — | — | — |
| Audit Trail | ✓ | ✓ V X | V | — | — | — | — | — |

## Full permission catalog

`dashboard.view` · `task.{view,create,update,delete,assign,comment}` ·
`lead.{view,create,update,delete,assign}` · `booking.{view,manage}` ·
`document.{view,create,update,delete,manage,download}` ·
`billing.{view,invoice.manage,po.manage,bill.manage,approve}` ·
`material.{view,create,approve}` · `email.{send,template.manage}` ·
`calendar.{view,manage}` · `report.{view,export}` ·
`marketing.{view,manage,approve}` · `lease.{view,manage}` · `architecture.{view,manage}` ·
`admin.{user.view,user.manage,department.manage,role.manage,project.manage,setting.manage,notification.manage}` ·
`audit.{view,export}`

## Enforcement points

- **Server actions** call `ensure('<permission>')` before any mutation.
- **Server pages** call `requirePermission('<permission>')`; denial → `/forbidden`.
- **Route handlers** (downloads, exports) check `can(ctx.permissions, …)` and 401/403.
- **Navigation & command palette** hide items the user can’t access (defence‑in‑depth, not
  the security boundary — the server checks are authoritative).
