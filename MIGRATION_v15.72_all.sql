-- Ameya Heights CRM — migration for v15.72 (Pan-India Due Diligence & RERA Vault)
-- Idempotent: safe to re-run. Run in Neon before deploying v15.72.
-- A record fetched from a state/local authority portal, filed against a project.

DO $$ BEGIN CREATE TYPE "RecordType" AS ENUM ('RERA_CERTIFICATE','ENCUMBRANCE_CERTIFICATE','LAND_RECORD_ROR','COURT_CLEARANCE','TOWN_PLANNING_APPROVAL','MUNICIPAL_SANCTION','HILL_AREA_CLEARANCE','MASTER_PLAN_EXTRACT'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "VerificationStatus" AS ENUM ('PENDING','VERIFIED','REJECTED','EXPIRED'); EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "DueDiligenceRecord" (
  "id" TEXT NOT NULL, "projectId" TEXT NOT NULL, "unitId" TEXT, "vendorId" TEXT, "recordType" "RecordType" NOT NULL,
  "state" TEXT NOT NULL, "region" TEXT, "authorityName" TEXT NOT NULL, "reference" TEXT, "documentUrl" TEXT,
  "validUntil" TIMESTAMP(3), "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING', "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DueDiligenceRecord_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "DueDiligenceRecord_projectId_idx" ON "DueDiligenceRecord"("projectId");
CREATE INDEX IF NOT EXISTS "DueDiligenceRecord_recordType_idx" ON "DueDiligenceRecord"("recordType");
CREATE INDEX IF NOT EXISTS "DueDiligenceRecord_verificationStatus_idx" ON "DueDiligenceRecord"("verificationStatus");
CREATE INDEX IF NOT EXISTS "DueDiligenceRecord_validUntil_idx" ON "DueDiligenceRecord"("validUntil");

DO $$ BEGIN
  ALTER TABLE "DueDiligenceRecord" ADD CONSTRAINT "DueDiligenceRecord_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
