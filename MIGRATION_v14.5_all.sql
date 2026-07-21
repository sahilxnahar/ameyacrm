-- MIGRATION v14.5 — Batch 5 (Programme & progress)
-- Idempotent. Adds 5 tables (ProgrammeActivity, ActivityDependency, ProgressUpdate,
-- BoqItem, DelayEntry) and their enums/indexes/FKs. Or just use the in-app repair button.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DependencyType') THEN
    CREATE TYPE "DependencyType" AS ENUM ('FS', 'SS', 'FF', 'SF');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DelayResponsibility') THEN
    CREATE TYPE "DelayResponsibility" AS ENUM ('DEVELOPER', 'CONTRACTOR', 'CONSULTANT', 'AUTHORITY', 'FORCE_MAJEURE', 'OTHER');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "ProgrammeActivity" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "wbsCode" TEXT,
    "name" TEXT NOT NULL,
    "plannedStart" TIMESTAMP(3),
    "plannedEnd" TIMESTAMP(3),
    "actualStart" TIMESTAMP(3),
    "actualEnd" TIMESTAMP(3),
    "durationDays" INTEGER NOT NULL DEFAULT 1,
    "percentComplete" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "plannedCost" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "actualCost" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "isMilestone" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProgrammeActivity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ActivityDependency" (
    "id" TEXT NOT NULL,
    "predecessorId" TEXT NOT NULL,
    "successorId" TEXT NOT NULL,
    "type" "DependencyType" NOT NULL DEFAULT 'FS',
    "lagDays" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ActivityDependency_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProgressUpdate" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "updateDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "percentComplete" DECIMAL(5,2) NOT NULL,
    "note" TEXT,
    "photoDocumentId" TEXT,
    "recordedById" TEXT,
    CONSTRAINT "ProgressUpdate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "BoqItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT NOT NULL,
    "unit" TEXT,
    "quantity" DECIMAL(16,3) NOT NULL DEFAULT 0,
    "rate" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BoqItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DelayEntry" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "activityId" TEXT,
    "cause" TEXT NOT NULL,
    "responsibility" "DelayResponsibility" NOT NULL DEFAULT 'OTHER',
    "days" INTEGER NOT NULL DEFAULT 0,
    "costImpact" DECIMAL(16,2),
    "note" TEXT,
    "occurredOn" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DelayEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProgrammeActivity_projectId_sortOrder_idx" ON "ProgrammeActivity"("projectId", "sortOrder");

CREATE INDEX IF NOT EXISTS "ActivityDependency_successorId_idx" ON "ActivityDependency"("successorId");

CREATE UNIQUE INDEX IF NOT EXISTS "ActivityDependency_predecessorId_successorId_key" ON "ActivityDependency"("predecessorId", "successorId");

CREATE INDEX IF NOT EXISTS "ProgressUpdate_activityId_updateDate_idx" ON "ProgressUpdate"("activityId", "updateDate");

CREATE INDEX IF NOT EXISTS "BoqItem_projectId_sortOrder_idx" ON "BoqItem"("projectId", "sortOrder");

CREATE INDEX IF NOT EXISTS "DelayEntry_projectId_idx" ON "DelayEntry"("projectId");

CREATE INDEX IF NOT EXISTS "DelayEntry_activityId_idx" ON "DelayEntry"("activityId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ActivityDependency_predecessorId_fkey') THEN
    ALTER TABLE "ActivityDependency" ADD CONSTRAINT "ActivityDependency_predecessorId_fkey" FOREIGN KEY ("predecessorId") REFERENCES "ProgrammeActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ActivityDependency_successorId_fkey') THEN
    ALTER TABLE "ActivityDependency" ADD CONSTRAINT "ActivityDependency_successorId_fkey" FOREIGN KEY ("successorId") REFERENCES "ProgrammeActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProgressUpdate_activityId_fkey') THEN
    ALTER TABLE "ProgressUpdate" ADD CONSTRAINT "ProgressUpdate_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "ProgrammeActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DelayEntry_activityId_fkey') THEN
    ALTER TABLE "DelayEntry" ADD CONSTRAINT "DelayEntry_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "ProgrammeActivity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
