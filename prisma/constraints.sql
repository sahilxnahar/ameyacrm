-- ═══════════════════════════════════════════════════════════════════════════
--  Constraints Prisma cannot express in schema.prisma.
--
--  `prisma db push` and `prisma migrate` build the schema from
--  prisma/schema.prisma, and that file has no syntax for a PARTIAL index — an
--  index with a WHERE clause. So every guarantee below is invisible to Prisma
--  and has to be applied separately.
--
--  This mattered. The ledger's double-post protection is a partial unique index
--  created only in MIGRATION_v16.5_all.sql. Production gets it (the generated
--  bootstrap the Repair button runs includes it), but any database built with
--  `prisma db push` — every developer machine, and CI — did not have it. The
--  test that proves the ledger refuses a double post had never run, because
--  LIVE_DB was unset everywhere; the first time CI ran it, it failed, because
--  the protection genuinely was not there.
--
--  Apply after any db push:
--      psql "$DATABASE_URL" -f prisma/constraints.sql
--
--  Idempotent. Safe to run on a live database at any time.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── The ledger posts a source document exactly once ────────────────────────
--
-- Two requests carrying the same source — a retried webhook, a double-clicked
-- button — can both pass an application-level "has this posted?" check and both
-- insert. The result is a trial balance that still balances and is doubled,
-- which is the hardest kind of wrong to notice. Only the database can settle
-- that race.
--
-- Partial, because a reversed entry deliberately keeps its source (that is how
-- the reversal is traced back), and a manual journal has no source at all.
CREATE UNIQUE INDEX IF NOT EXISTS "JournalEntry_source_once_idx"
  ON "JournalEntry"("sourceType", "sourceId")
  WHERE "sourceId" IS NOT NULL AND "status" <> 'REVERSED';

-- If the statement above fails, this database already contains duplicate
-- postings. Find them with:
--
--   SELECT "sourceType", "sourceId", count(*), array_agg("number")
--   FROM "JournalEntry"
--   WHERE "sourceId" IS NOT NULL AND "status" <> 'REVERSED'
--   GROUP BY 1, 2 HAVING count(*) > 1;
--
-- Reverse the surplus entries — never delete them — then re-run.

-- ── One live MSME clock per supplier bill ──────────────────────────────────
-- vendorBillId is already @unique in schema.prisma, so this is belt to that
-- brace and exists only to keep every ledger-adjacent guarantee in one file.
DO $$
BEGIN
  IF to_regclass('"MsmePaymentClock"') IS NOT NULL THEN
    CREATE UNIQUE INDEX IF NOT EXISTS "MsmePaymentClock_bill_once_idx"
      ON "MsmePaymentClock"("vendorBillId");
  END IF;
END $$;

-- Confirm. Both rows should read 'present'.
SELECT 'JournalEntry_source_once_idx' AS constraint,
       CASE WHEN EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'JournalEntry_source_once_idx')
            THEN 'present' ELSE 'MISSING — the ledger can double-post' END AS status
UNION ALL
SELECT 'MsmePaymentClock_bill_once_idx',
       CASE WHEN EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'MsmePaymentClock_bill_once_idx')
            THEN 'present' ELSE 'not applicable on this database' END;

-- ═══════════════════════════════════════════════════════════════════════════
--  Performance: the partial indexes the list screens need (AMH-023).
--
--  Every list screen in the CRM filters `deletedAt IS NULL` and then sorts.
--  The obvious fix is a composite @@index([deletedAt, updatedAt]) in
--  schema.prisma. It was tried first, and measured on 60,000 leads:
--
--      composite [deletedAt, updatedAt]   794 buffers   13.3 ms   (planner
--                                                                  ignored it
--                                                                  and seq
--                                                                  scanned)
--      partial (updatedAt) WHERE NULL       3 buffers    0.04 ms
--
--  The composite loses because `deletedAt IS NULL` matches 95% of the rows, so
--  it is not selective and the planner correctly declines to use it. The index
--  is 3.3 MB of write overhead that never earns anything back. The partial
--  index contains only the live rows, is 1.2 MB, and is ordered exactly as the
--  screen reads — so the query becomes a 25-row walk with no sort at all.
--
--  schema.prisma has no syntax for a WHERE clause on an index, which is why
--  these are here rather than there.
-- ═══════════════════════════════════════════════════════════════════════════

-- Sales board and /api/v1/leads: WHERE deletedAt IS NULL ORDER BY updatedAt DESC
CREATE INDEX IF NOT EXISTS "Lead_live_updated_idx"
  ON "Lead" ("updatedAt" DESC) WHERE "deletedAt" IS NULL;

-- Explorer, AI index, duplicate sweep: same filter, ordered by createdAt
CREATE INDEX IF NOT EXISTS "Lead_live_created_idx"
  ON "Lead" ("createdAt" DESC) WHERE "deletedAt" IS NULL;

-- Recent-tasks lists. Measured: 1103 buffers / 14.0 ms → 3 buffers / 0.03 ms.
CREATE INDEX IF NOT EXISTS "Task_live_created_idx"
  ON "Task" ("createdAt" DESC) WHERE "deletedAt" IS NULL;

-- The Kanban board reads WHERE deletedAt IS NULL AND parentId IS NULL
-- ORDER BY position ASC, createdAt DESC LIMIT 300. Both filters go in the
-- predicate, both sort keys go in the index, so it is a straight 300-row walk.
-- Measured: 1103 buffers / 12.1 ms → 8 buffers / 0.14 ms.
CREATE INDEX IF NOT EXISTS "Task_board_idx"
  ON "Task" ("position", "createdAt" DESC)
  WHERE "deletedAt" IS NULL AND "parentId" IS NULL;

-- Confirm.
SELECT idx AS index, CASE WHEN EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = idx)
                          THEN 'present' ELSE 'MISSING' END AS status
FROM unnest(ARRAY[
  'Lead_live_updated_idx', 'Lead_live_created_idx',
  'Task_live_created_idx', 'Task_board_idx'
]) AS idx;
