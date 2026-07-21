-- MIGRATION v14.6 — Batch 14 (Quality & safety)
-- Idempotent. Adds Inspection, InspectionItem, NonConformance, SafetyRecord,
-- WorkPermit and their enums/indexes/FKs. Or use the in-app repair button.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InspectionStatus') THEN
    CREATE TYPE "InspectionStatus" AS ENUM ('SCHEDULED', 'PASSED', 'FAILED');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NcrSeverity') THEN
    CREATE TYPE "NcrSeverity" AS ENUM ('MINOR', 'MAJOR', 'CRITICAL');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NcrStatus') THEN
    CREATE TYPE "NcrStatus" AS ENUM ('RAISED', 'ASSIGNED', 'RECTIFIED', 'VERIFIED', 'CLOSED');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SafetyKind') THEN
    CREATE TYPE "SafetyKind" AS ENUM ('INCIDENT', 'NEAR_MISS', 'TOOLBOX_TALK');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SafetySeverity') THEN
    CREATE TYPE "SafetySeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PermitType') THEN
    CREATE TYPE "PermitType" AS ENUM ('HOT_WORK', 'HEIGHT', 'CONFINED_SPACE', 'LIFTING', 'ELECTRICAL', 'EXCAVATION', 'OTHER');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PermitStatus') THEN
    CREATE TYPE "PermitStatus" AS ENUM ('OPEN', 'CLOSED', 'EXPIRED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "Inspection" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "activityId" TEXT,
    "title" TEXT NOT NULL,
    "discipline" TEXT,
    "isHoldPoint" BOOLEAN NOT NULL DEFAULT false,
    "status" "InspectionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "inspectedBy" TEXT,
    "inspectedOn" TIMESTAMP(3),
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Inspection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "InspectionItem" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "passed" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    CONSTRAINT "InspectionItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "NonConformance" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "activityId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "severity" "NcrSeverity" NOT NULL DEFAULT 'MAJOR',
    "status" "NcrStatus" NOT NULL DEFAULT 'RAISED',
    "assignedTo" TEXT,
    "costImpact" DECIMAL(16,2),
    "raisedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedOn" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NonConformance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SafetyRecord" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" "SafetyKind" NOT NULL DEFAULT 'INCIDENT',
    "severity" "SafetySeverity" NOT NULL DEFAULT 'LOW',
    "description" TEXT NOT NULL,
    "rootCause" TEXT,
    "personsAffected" INTEGER NOT NULL DEFAULT 0,
    "occurredOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SafetyRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WorkPermit" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "PermitType" NOT NULL DEFAULT 'OTHER',
    "status" "PermitStatus" NOT NULL DEFAULT 'OPEN',
    "issuedTo" TEXT NOT NULL,
    "location" TEXT,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "closedOn" TIMESTAMP(3),
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkPermit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Inspection_projectId_status_idx" ON "Inspection"("projectId", "status");

CREATE INDEX IF NOT EXISTS "Inspection_activityId_idx" ON "Inspection"("activityId");

CREATE INDEX IF NOT EXISTS "InspectionItem_inspectionId_idx" ON "InspectionItem"("inspectionId");

CREATE INDEX IF NOT EXISTS "NonConformance_projectId_status_idx" ON "NonConformance"("projectId", "status");

CREATE INDEX IF NOT EXISTS "SafetyRecord_projectId_kind_idx" ON "SafetyRecord"("projectId", "kind");

CREATE INDEX IF NOT EXISTS "SafetyRecord_occurredOn_idx" ON "SafetyRecord"("occurredOn");

CREATE INDEX IF NOT EXISTS "WorkPermit_projectId_status_idx" ON "WorkPermit"("projectId", "status");

CREATE INDEX IF NOT EXISTS "WorkPermit_validTo_idx" ON "WorkPermit"("validTo");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InspectionItem_inspectionId_fkey') THEN
    ALTER TABLE "InspectionItem" ADD CONSTRAINT "InspectionItem_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
