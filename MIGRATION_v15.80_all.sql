-- v15.80 — Phase 6: Site Ops & 4D BIM (field engineering).
-- Adds DailySiteLog + SitePhoto ALONGSIDE the existing ConstructionUpdate /
-- ProgressUpdate / SiteReading models. Fully additive: two new tables, two new
-- foreign keys onto existing "Project" and "User" rows, no existing table or
-- column is altered or dropped. Safe to run more than once (IF NOT EXISTS guards).

-- ── DailySiteLog ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "DailySiteLog" (
    "id"         TEXT NOT NULL,
    "date"       TIMESTAMP(3) NOT NULL,
    "weather"    TEXT NOT NULL,
    "laborCount" INTEGER NOT NULL DEFAULT 0,
    "notes"      TEXT,
    "projectId"  TEXT NOT NULL,
    "authorId"   TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DailySiteLog_pkey" PRIMARY KEY ("id")
);

-- ── SitePhoto ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "SitePhoto" (
    "id"             TEXT NOT NULL,
    "url"            TEXT NOT NULL,
    "milestoneTag"   TEXT NOT NULL,
    "capturedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dailySiteLogId" TEXT NOT NULL,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SitePhoto_pkey" PRIMARY KEY ("id")
);

-- ── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "DailySiteLog_projectId_date_idx" ON "DailySiteLog" ("projectId", "date");
CREATE INDEX IF NOT EXISTS "DailySiteLog_authorId_idx"       ON "DailySiteLog" ("authorId");
CREATE INDEX IF NOT EXISTS "SitePhoto_dailySiteLogId_idx"    ON "SitePhoto" ("dailySiteLogId");
CREATE INDEX IF NOT EXISTS "SitePhoto_milestoneTag_idx"      ON "SitePhoto" ("milestoneTag");

-- ── Foreign keys (guarded so re-runs don't error) ───────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DailySiteLog_projectId_fkey') THEN
    ALTER TABLE "DailySiteLog"
      ADD CONSTRAINT "DailySiteLog_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DailySiteLog_authorId_fkey') THEN
    ALTER TABLE "DailySiteLog"
      ADD CONSTRAINT "DailySiteLog_authorId_fkey"
      FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SitePhoto_dailySiteLogId_fkey') THEN
    ALTER TABLE "SitePhoto"
      ADD CONSTRAINT "SitePhoto_dailySiteLogId_fkey"
      FOREIGN KEY ("dailySiteLogId") REFERENCES "DailySiteLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
