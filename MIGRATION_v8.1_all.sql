-- Ameya Heights CRM v8.0 — document Q&A, floor plans, field ops, onboarding.
-- Safe to re-run.

DO $$ BEGIN CREATE TYPE "AttendanceKind" AS ENUM ('CHECK_IN','CHECK_OUT');                          EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ShiftKind"      AS ENUM ('MORNING','EVENING','NIGHT','FULL_DAY','OFF');    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "DocChunk" (
  "id" TEXT NOT NULL,
  "documentId" TEXT, "fileObjectId" TEXT,
  "title" TEXT NOT NULL, "source" TEXT, "page" INTEGER,
  "ordinal" INTEGER NOT NULL DEFAULT 0,
  "content" TEXT NOT NULL,
  "embedding" DOUBLE PRECISION[] NOT NULL DEFAULT ARRAY[]::DOUBLE PRECISION[],
  "tokens" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocChunk_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "DocChunk_documentId_idx"   ON "DocChunk"("documentId");
CREATE INDEX IF NOT EXISTS "DocChunk_fileObjectId_idx" ON "DocChunk"("fileObjectId");

CREATE TABLE IF NOT EXISTS "FloorPlan" (
  "id" TEXT NOT NULL, "projectId" TEXT NOT NULL,
  "name" TEXT NOT NULL, "tower" TEXT, "floor" INTEGER,
  "imageUrl" TEXT NOT NULL,
  "imageWidth" INTEGER NOT NULL DEFAULT 1000,
  "imageHeight" INTEGER NOT NULL DEFAULT 700,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FloorPlan_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "FloorPlan_projectId_idx" ON "FloorPlan"("projectId");

CREATE TABLE IF NOT EXISTS "UnitPin" (
  "id" TEXT NOT NULL, "floorPlanId" TEXT NOT NULL, "unitId" TEXT NOT NULL,
  "x" DOUBLE PRECISION NOT NULL, "y" DOUBLE PRECISION NOT NULL,
  "w" DOUBLE PRECISION NOT NULL DEFAULT 8, "h" DOUBLE PRECISION NOT NULL DEFAULT 8,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UnitPin_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "UnitPin_floorPlanId_unitId_key" ON "UnitPin"("floorPlanId","unitId");
CREATE INDEX IF NOT EXISTS "UnitPin_unitId_idx" ON "UnitPin"("unitId");

CREATE TABLE IF NOT EXISTS "Attendance" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "projectId" TEXT,
  "kind" "AttendanceKind" NOT NULL,
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "latitude" DOUBLE PRECISION, "longitude" DOUBLE PRECISION,
  "accuracyM" DOUBLE PRECISION, "distanceM" DOUBLE PRECISION,
  "withinSite" BOOLEAN NOT NULL DEFAULT false,
  "note" TEXT, "photoUrl" TEXT,
  "offline" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Attendance_userId_at_idx"    ON "Attendance"("userId","at");
CREATE INDEX IF NOT EXISTS "Attendance_projectId_at_idx" ON "Attendance"("projectId","at");

CREATE TABLE IF NOT EXISTS "DutyRoster" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "projectId" TEXT,
  "date" TIMESTAMP(3) NOT NULL,
  "shift" "ShiftKind" NOT NULL DEFAULT 'FULL_DAY',
  "note" TEXT, "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DutyRoster_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "DutyRoster_userId_date_key" ON "DutyRoster"("userId","date");
CREATE INDEX IF NOT EXISTS "DutyRoster_date_idx" ON "DutyRoster"("date");

CREATE TABLE IF NOT EXISTS "OnboardingStep" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "stepKey" TEXT NOT NULL,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OnboardingStep_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "OnboardingStep_userId_stepKey_key" ON "OnboardingStep"("userId","stepKey");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='FloorPlan_projectId_fkey') THEN
    ALTER TABLE "FloorPlan" ADD CONSTRAINT "FloorPlan_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='UnitPin_floorPlanId_fkey') THEN
    ALTER TABLE "UnitPin" ADD CONSTRAINT "UnitPin_floorPlanId_fkey"
      FOREIGN KEY ("floorPlanId") REFERENCES "FloorPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='UnitPin_unitId_fkey') THEN
    ALTER TABLE "UnitPin" ADD CONSTRAINT "UnitPin_unitId_fkey"
      FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='Attendance_userId_fkey') THEN
    ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='DutyRoster_userId_fkey') THEN
    ALTER TABLE "DutyRoster" ADD CONSTRAINT "DutyRoster_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
-- Ameya Heights CRM v8.1 — personal navigation + query indexes. Safe to re-run.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "navPrefs" JSONB;

-- Indexes for the queries the calendar, forecast and escalation run constantly.
CREATE INDEX IF NOT EXISTS "Lead_nextFollowUp_idx"      ON "Lead"("nextFollowUp");
CREATE INDEX IF NOT EXISTS "Lead_status_ownerId_idx"    ON "Lead"("status","ownerId");
CREATE INDEX IF NOT EXISTS "Task_dueDate_idx"           ON "Task"("dueDate");
CREATE INDEX IF NOT EXISTS "Task_status_idx"            ON "Task"("status");
CREATE INDEX IF NOT EXISTS "PaymentMilestone_dueDate_idx" ON "PaymentMilestone"("dueDate");
CREATE INDEX IF NOT EXISTS "PaymentMilestone_status_idx"  ON "PaymentMilestone"("status");
CREATE INDEX IF NOT EXISTS "Booking_bookedAt_idx"       ON "Booking"("bookedAt");
CREATE INDEX IF NOT EXISTS "CalendarEvent_startAt_idx"  ON "CalendarEvent"("startAt");
CREATE INDEX IF NOT EXISTS "Reminder_dueAt_status_idx"  ON "Reminder"("dueAt","status");
CREATE INDEX IF NOT EXISTS "Unit_projectId_status_idx"  ON "Unit"("projectId","status");
CREATE INDEX IF NOT EXISTS "SocialActivity_isRead_idx"  ON "SocialActivity"("isRead");
