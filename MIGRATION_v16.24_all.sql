-- Ameya OS — MIGRATION_v16.24_all.sql
--
-- One new table. Nothing existing is altered, no data is rewritten, and running
-- it twice is a no-op.
--
--   psql "$DATABASE_URL" -f MIGRATION_v16.24_all.sql
--
-- The in-app Repair button (Admin → Settings) does the same thing.
--
-- ── What this is for ───────────────────────────────────────────────────────
--
-- Undo (AMH-033). Deleting something in the CRM was final: undo existed on 3 of
-- roughly 120 destructive surfaces.
--
-- The obvious fix is a `deletedAt` column on every model. That was rejected
-- deliberately — it means a migration across dozens of tables AND a
-- `deletedAt IS NULL` filter added to every query that touches them. Miss one
-- filter and deleted rows quietly reappear in a list, which is a worse bug than
-- the one being fixed and invisible until somebody spots a name they deleted
-- months ago.
--
-- So the delete stays a real delete, and the row's own JSON is kept beside it
-- for 72 hours. Every existing query is untouched. Undo is an insert.

CREATE TABLE IF NOT EXISTS "DeletedRecord" (
  "id"          TEXT NOT NULL,
  -- Prisma model name, e.g. 'Reminder'. Picks the delegate on restore.
  "model"       TEXT NOT NULL,
  -- The primary key the row had. It is restored with the SAME id, so anything
  -- that referenced it — an audit line, a link, a document — resolves again.
  "recordId"    TEXT NOT NULL,
  -- A one-line description, for the audit trail and the toast.
  "label"       TEXT NOT NULL,
  -- The row as it was.
  "payload"     JSONB NOT NULL,
  "deletedById" TEXT,
  "deletedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Set once put back; a record is restorable exactly once.
  "restoredAt"  TIMESTAMP(3),
  CONSTRAINT "DeletedRecord_pkey" PRIMARY KEY ("id")
);

-- "what did I just delete" — the recycle bin, per person, newest first.
CREATE INDEX IF NOT EXISTS "DeletedRecord_deletedById_deletedAt_idx"
  ON "DeletedRecord" ("deletedById", "deletedAt");

-- "has this row been deleted before" — and the nightly prune.
CREATE INDEX IF NOT EXISTS "DeletedRecord_model_recordId_idx"
  ON "DeletedRecord" ("model", "recordId");

-- Confirm. Both rows should read 'present'.
SELECT 'DeletedRecord' AS object,
       CASE WHEN to_regclass('"DeletedRecord"') IS NOT NULL THEN 'present' ELSE 'MISSING' END AS status
UNION ALL
SELECT 'DeletedRecord indexes',
       CASE WHEN (SELECT count(*) FROM pg_indexes WHERE tablename = 'DeletedRecord') >= 3
            THEN 'present' ELSE 'MISSING' END;
