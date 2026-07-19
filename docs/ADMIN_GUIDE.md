# Administrator Guide

For Super Admins and Admins. Everything here is reachable from **Admin** and **Settings**.

## First‑run checklist

1. Sign in as `superadmin`, open **Settings → Security**, change the password and **enable
   2FA** (scan the QR, verify, save backup codes).
2. **Admin → Departments** — confirm the 13 seeded departments; add any you need.
3. **Admin → Users** — create real users; each gets a temporary password and is forced to
   change it on first login. Assign the correct **role** and **department**.
4. Rotate/disable the demo users (`priya.sales`, `rahul.mgr`, …) once real accounts exist.
5. Review **branding** in `src/config/brand.ts` (already set to the Ameya Heights kit).

## Users

**Admin → Users → New user.** Fields: name, username, email, phone, employee ID,
designation, role, department, temporary password (≥12 chars, mixed). New users must change
their password at first login.

Per‑user actions (row menu):
- **Force password reset** — invalidates sessions and requires a new password.
- **Disable / Activate** — disabling revokes all active sessions immediately.

## Departments

**Admin → Departments → New department.** Departments are unlimited and created without
code. Assign a **head** (used for approvals and dashboards) by setting `headId` (Prisma
Studio or a future UI toggle).

## Roles & permissions

Eight roles ship with sensible defaults (see [RBAC_MATRIX](RBAC_MATRIX.md)). Every
permission is a row you can re‑map:

- **Role‑level:** edit `RolePermission` (ALLOW/DENY per role).
- **User‑level:** add `UserPermission` overrides (DENY always wins).

Until you customize, code defaults apply so no one is ever locked out.

## Email templates

`EmailTemplate` rows drive structured emails (e.g. `material_request`). Placeholders use
`{{var}}`. Edit subject/body to change how generated emails read. Keep RERA wording until
registration completes.

## Notifications

Delivery channels: in‑app (always), email (per provider), web‑push (needs VAPID keys). Users
tune categories and quiet hours via `NotificationPreference`. To enable push org‑wide, set
`VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`.

## System settings & branding

- **Branding:** `src/config/brand.ts` + `globals.css` (colours, fonts, logo). One edit
  re‑skins everything. Runtime overrides can be stored in the `Setting` table
  (`branding.*`).
- **Policies:** password expiry, lockout thresholds, session TTL/idle — all env‑driven
  (`.env`). Change and restart.

## Audit & compliance

**Audit** shows every sensitive action with actor, IP and timestamp; filter by action and
**export CSV**. Use it for access reviews and incident response. Audit rows are append‑only.

## Routine operations

- **Backups:** see [BACKUP_RECOVERY](BACKUP_RECOVERY.md).
- **Health:** `GET /api/health` for uptime monitoring.
- **Upgrades:** pull, `npm ci`, `prisma migrate deploy`, rebuild/redeploy. CI gates lint,
  types, tests and build.
