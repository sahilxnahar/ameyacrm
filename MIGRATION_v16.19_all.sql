-- Ameya OS — MIGRATION_v16.19_all.sql
--
-- Indexes only. No column is added, no column is dropped, no data is rewritten,
-- and running it twice is a no-op.
--
--   psql "$DATABASE_URL" -f MIGRATION_v16.19_all.sql
--
-- The in-app Repair button (Admin → Settings) does the same thing.
--
-- ── Why ────────────────────────────────────────────────────────────────────
--
-- Every list screen in the CRM filters `deletedAt IS NULL` and then sorts.
-- Lead had indexes on status, ownerId, isNri and nextFollowUp; Task had five
-- single-column ones; Notification had (userId, readAt) and (createdAt). None of
-- them fit the queries the screens actually run, so the Sales board, the
-- Explorer, the recent-tasks list, the Kanban board and the notification bell
-- were each doing a sequential scan plus an in-memory sort on every load.
--
-- Measured on a seeded database — 60,000 leads, 80,000 tasks, 200,000
-- notifications — with EXPLAIN (ANALYZE, BUFFERS):
--
--   Sales board       794 buffers  13.3 ms  →     3 buffers  0.04 ms
--   Explorer          794 buffers  13.3 ms  →     3 buffers  0.04 ms
--   Recent tasks     1103 buffers  14.0 ms  →     3 buffers  0.03 ms
--   Kanban board     1103 buffers  12.1 ms  →     8 buffers  0.14 ms
--   Bell             7727 buffers   0.99 ms →    42 buffers  0.04 ms
--
-- The buffer counts matter more than the milliseconds. Those timings are on a
-- warm cache on one machine with no other load; the buffer count is the work
-- itself, and it is what multiplies when a thousand users each load a screen.
--
-- ── Why some of these are PARTIAL indexes ──────────────────────────────────
--
-- The obvious fix is a composite index on (deletedAt, updatedAt). That was
-- tried first and measured: the planner ignored it and sequentially scanned
-- anyway, because `deletedAt IS NULL` matches 95% of the rows and so is not
-- selective. It would have been 3.3 MB of write overhead per index that never
-- earned anything back — an index that looks like a fix in a diff and does
-- nothing in production.
--
-- A partial index contains only the live rows, is a third of the size, and is
-- already in the order the screen reads, so the query becomes a short walk with
-- no sort at all.
--
-- ── About CONCURRENTLY ─────────────────────────────────────────────────────
--
-- CREATE INDEX CONCURRENTLY does not take a write lock, which is what you want
-- on a busy table. It cannot run inside a transaction block, and the Repair
-- button wraps everything in a DO block, so it is not usable here. At Ameya's
-- present size these are sub-second locks. If Lead or Task has grown past a
-- million rows by the time you read this, run the statements below by hand with
-- CONCURRENTLY added and skip this file.

DO $$
BEGIN

  -- ── Lead ──────────────────────────────────────────────────────────────────
  IF to_regclass('"Lead"') IS NULL THEN
    RAISE NOTICE 'Lead not present — skipping (run /api/setup first).';
  ELSE
    -- Sales board, /api/v1/leads
    CREATE INDEX IF NOT EXISTS "Lead_live_updated_idx"
      ON "Lead" ("updatedAt" DESC) WHERE "deletedAt" IS NULL;
    -- Explorer, AI index, duplicate sweep
    CREATE INDEX IF NOT EXISTS "Lead_live_created_idx"
      ON "Lead" ("createdAt" DESC) WHERE "deletedAt" IS NULL;
    -- The active-project scope applied on nearly every sales screen. Not
    -- partial: projectId is selective on its own, so a plain composite works
    -- and the planner uses it (confirmed: Index Scan, 2 buffers).
    CREATE INDEX IF NOT EXISTS "Lead_projectId_deletedAt_idx"
      ON "Lead" ("projectId", "deletedAt");
    RAISE NOTICE 'Lead: list indexes present.';
  END IF;

  -- ── Notification ──────────────────────────────────────────────────────────
  -- The bell and the notifications page both read
  --   WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT n
  -- ("userId","readAt") cannot serve the sort and ("createdAt") cannot serve the
  -- filter. Postgres used the createdAt index and filtered — walking 3,787 rows
  -- to return 20. Every bell poll, for every user, on a timer.
  IF to_regclass('"Notification"') IS NULL THEN
    RAISE NOTICE 'Notification not present — skipping.';
  ELSE
    CREATE INDEX IF NOT EXISTS "Notification_userId_createdAt_idx"
      ON "Notification" ("userId", "createdAt");
    RAISE NOTICE 'Notification: bell index present.';
  END IF;

  -- ── Task ──────────────────────────────────────────────────────────────────
  -- Nothing is added for the due-date screens: @@index([dueDate]) already
  -- serves Today, the dashboard and the digest at 3 buffers. Measured, not
  -- assumed — an earlier draft of this migration added two indexes there that
  -- the planner never touched.
  IF to_regclass('"Task"') IS NULL THEN
    RAISE NOTICE 'Task not present — skipping.';
  ELSE
    CREATE INDEX IF NOT EXISTS "Task_live_created_idx"
      ON "Task" ("createdAt" DESC) WHERE "deletedAt" IS NULL;
    -- listBoardTasks: WHERE deletedAt IS NULL AND parentId IS NULL
    --                 ORDER BY position ASC, createdAt DESC LIMIT 300
    -- Both filters in the predicate, both sort keys in the index.
    CREATE INDEX IF NOT EXISTS "Task_board_idx"
      ON "Task" ("position", "createdAt" DESC)
      WHERE "deletedAt" IS NULL AND "parentId" IS NULL;
    RAISE NOTICE 'Task: board and recent-list indexes present.';
  END IF;

END $$;

-- Confirm. Every row should read 'present'.
SELECT idx AS index, CASE WHEN EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = idx)
                          THEN 'present' ELSE 'MISSING' END AS status
FROM unnest(ARRAY[
  'Lead_live_updated_idx',
  'Lead_live_created_idx',
  'Lead_projectId_deletedAt_idx',
  'Notification_userId_createdAt_idx',
  'Task_live_created_idx',
  'Task_board_idx'
]) AS idx;
