-- MIGRATION v14.14 — Two batches: Report Builder(10) + Insights/AI depth(9).
-- Batch 9 (cost anomalies, lead-score spread) is statistical and needs no
-- schema change. Batch 10 adds one table for saved report definitions.
-- Idempotent — safe to run more than once. Or use the in-app repair button.

CREATE TABLE IF NOT EXISTS "SavedReport" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "groupBy" TEXT NOT NULL,
    "metric" TEXT NOT NULL DEFAULT 'count',
    "valueKey" TEXT,
    "shared" BOOLEAN NOT NULL DEFAULT false,
    "ownerId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SavedReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SavedReport_ownerId_idx" ON "SavedReport"("ownerId");
