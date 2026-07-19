# Database

PostgreSQL, modelled with Prisma. **56 models · 25 enums.** The canonical source is
[`prisma/schema.prisma`](../prisma/schema.prisma); the initial DDL lives in
[`prisma/migrations`](../prisma/migrations).

## Conventions

- Primary keys are `cuid()` strings. Timestamps `createdAt` / `updatedAt` are on every
  mutable entity; soft‑deletable entities carry `deletedAt`.
- Money uses `Decimal(14,2)`; areas `Decimal(10,2)`.
- Foreign keys use `onDelete: SetNull` for optional references and `Cascade` for owned
  children (e.g. task comments, invoice items). High‑volume look‑up columns are indexed.
- Encrypted/hashed fields never store plaintext: `Session.tokenHash` (SHA‑256),
  `User.twoFactorSecret` (AES‑256‑GCM), `User.passwordHash` / `BackupCode.codeHash` (bcrypt).

## Domain map

```
Organization
  Project 1─* ProjectMembership *─1 User
  Project 1─* Unit
  Department 1─* User            Department 1─0..1 User (head)

Identity & Security
  User 1─* Session · BackupCode · TrustedDevice · WebAuthnCredential
  User 1─* LoginHistory · PasswordHistory
  RBAC: Permission *─* RoleName (RolePermission) ; User *─* Permission (UserPermission)

Tasks
  Task 1─* TaskAssignee ·  ChecklistItem · TaskComment · TaskAttachment · TaskActivity
  Task *─* Task (Subtasks, Dependencies, Watchers, Labels)

Sales / Real estate
  Lead 1─* LeadActivity ;  Lead 1─* Booking *─1 Unit ;  Booking 1─* PaymentMilestone

Documents
  Folder (tree, materialized path) 1─* Document 1─* DocumentVersion *─1 FileObject
  Folder 1─* FolderPermission ;  Document *─* Tag

Billing
  Invoice 1─* InvoiceItem ;  PurchaseOrder 1─* POItem ;  Vendor 1─* PO / VendorBill

Requests & workflow
  MaterialRequest 1─* MaterialRequestItem
  MaterialRequest 1─0..1 EmailMessage 1─* EmailAttachment
  ApprovalRequest 1─* ApprovalStep   (polymorphic entityType/entityId)

Ops
  CalendarEvent 1─* EventAttendee
  Notification · NotificationPreference · PushSubscription
  Announcement · AuditLog · Setting · EmailTemplate
```

## Multi‑project & multi‑department

`Project` and `Department` are referenced (nullable) throughout the operational tables
(`Task`, `Lead`, `MaterialRequest`, `Invoice`, `PurchaseOrder`, `Folder`, `CalendarEvent`,
`Announcement`). Adding projects/departments is pure data — no schema change — satisfying
the “1 project now, 10+ later, unlimited departments” requirement.

## Notable indexes

`User(status|departmentId|role)`, `Task(status|projectId|departmentId|dueDate|createdById)`,
`Lead(status|ownerId|isNri)`, `Document(folderId|expiresAt)`, `Notification(userId, readAt)`,
`AuditLog(actorId|entityType,entityId|action|createdAt)`, `Session(userId|expiresAt)`.

## Working with the schema

```bash
npm run prisma:migrate     # create/apply a dev migration
npm run prisma:deploy      # apply migrations in prod (used by Docker entrypoint)
npm run prisma:studio      # visual browser
npm run db:seed            # seed baseline + demo data
```

To evolve the schema: edit `schema.prisma`, run `npm run prisma:migrate -- --name <change>`,
commit the generated migration. CI applies migrations against a disposable Postgres before
type‑checking and building.
