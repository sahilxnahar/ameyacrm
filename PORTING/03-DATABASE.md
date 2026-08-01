# 3 — Database: migrations, backups, restoring

## Back up first. Always.

```bash
pg_dump "$DATABASE_URL_UNPOOLED" -Fc -f "ameya-backup-$(date +%Y%m%d-%H%M).dump"
```

`-Fc` is the compressed custom format — smaller, and it restores selectively.
Keep the file somewhere that is not the server it came from.

Restoring:

```bash
pg_restore --clean --if-exists -d "$DATABASE_URL_UNPOOLED" ameya-backup-20260801-1430.dump
```

> On Neon you also have **branch → restore** in the dashboard, which is faster
> and does not need `pg_dump` installed. Use it for "undo the last hour"; use
> `pg_dump` for "keep a copy off this platform".

---

## Two different commands — do not mix them up

| Command | Use on | Effect |
|---|---|---|
| `npx prisma db push` | An **empty** database | Builds the schema from scratch |
| A `MIGRATION_*.sql` file | A database **with data** | Alters what is there, keeping rows |

Running `db push` against a live database can drop columns to make the shape
match. Never point it at production.

## Applying a migration

Each release ships its SQL alongside the zip. To apply it:

**Neon SQL Editor (easiest)** — paste the file's contents in, run it, read the
output.

**Command line:**

```bash
psql "$DATABASE_URL_UNPOOLED" -f MIGRATION_v15.95_all.sql
```

Always on the **unpooled** URL. A pooler cannot hold the locks a migration needs.

## Migrations are written to be re-runnable

Every migration in this project uses `IF NOT EXISTS` / `IF EXISTS` guards, so
running one twice is harmless. If you are unsure whether it applied, run it
again — that is safer than guessing.

## Checking a migration worked

```sql
-- Does the new column exist?
SELECT column_name FROM information_schema.columns
WHERE table_name = 'User' AND column_name = 'topNavPrefs';

-- Do the books still balance? (Should return zero rows.)
SELECT "entryId", SUM(debit) AS dr, SUM(credit) AS cr
FROM "JournalLine" GROUP BY "entryId" HAVING SUM(debit) <> SUM(credit);
```

That second query is the one worth keeping. In double-entry accounting every
entry's debits must equal its credits; a row coming back means something wrote a
lopsided entry and the trial balance will not add up.

## Copying production into a test database

```bash
pg_dump "$PROD_UNPOOLED" -Fc -f prod.dump
pg_restore --clean --if-exists -d "$TEST_UNPOOLED" prod.dump
```

Then, on the copy, scrub anything you should not have lying around in a test
environment:

```sql
UPDATE "User" SET email = 'user-' || id || '@example.invalid', phone = NULL;
UPDATE "Lead" SET phone = NULL, email = NULL;
DELETE FROM "Session";
```

Real buyer phone numbers in a test database are a data-protection problem
waiting to happen.
