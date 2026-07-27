-- Ameya Heights CRM — migration for v15.60 (Legal group completion)
-- Modules 83 (NRI/FEMA), 86 (Arbitration/ADR), 89 (e-Stamping), 90 (REAT/HC).
-- Idempotent: safe to re-run. Run in Neon before deploying v15.60.

DO $$ BEGIN CREATE TYPE "NriComplianceStatus" AS ENUM ('PENDING','SUBMITTED','VERIFIED','REJECTED'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "AdrStage" AS ENUM ('NOTICE_ISSUED','CONCILIATION','ARBITRATOR_APPOINTED','PLEADINGS','HEARINGS','AWARD','SETTLED','CHALLENGED','CLOSED'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "EstampStatus" AS ENUM ('REQUESTED','GENERATED','USED','CANCELLED','FAILED'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "LitForum" AS ENUM ('RERA_AUTHORITY','REAT','HIGH_COURT','SUPREME_COURT'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "LitStatus" AS ENUM ('FILED','ADMITTED','INTERIM_ORDER','ARGUMENTS','RESERVED','DISPOSED','APPEALED'); EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "NriComplianceProfile" (
  "id" TEXT NOT NULL, "leadId" TEXT, "bookingId" TEXT, "taxResidency" TEXT NOT NULL,
  "fatcaDeclared" BOOLEAN NOT NULL DEFAULT false, "fatcaFormRef" TEXT, "femaCategory" TEXT,
  "passportNo" TEXT, "overseasAddress" TEXT, "status" "NriComplianceStatus" NOT NULL DEFAULT 'PENDING',
  "verifiedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NriComplianceProfile_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "NriComplianceProfile_leadId_idx" ON "NriComplianceProfile"("leadId");
CREATE INDEX IF NOT EXISTS "NriComplianceProfile_bookingId_idx" ON "NriComplianceProfile"("bookingId");
CREATE INDEX IF NOT EXISTS "NriComplianceProfile_status_idx" ON "NriComplianceProfile"("status");

CREATE TABLE IF NOT EXISTS "ForeignRemittance" (
  "id" TEXT NOT NULL, "profileId" TEXT NOT NULL, "bookingId" TEXT, "voucherId" TEXT,
  "amountForeign" DECIMAL(16,2) NOT NULL, "currency" TEXT NOT NULL, "amountInr" DECIMAL(16,2) NOT NULL,
  "fireReference" TEXT, "receivedOn" TIMESTAMP(3), "reportDueOn" TIMESTAMP(3), "reportedOn" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ForeignRemittance_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ForeignRemittance_profileId_idx" ON "ForeignRemittance"("profileId");
CREATE INDEX IF NOT EXISTS "ForeignRemittance_bookingId_idx" ON "ForeignRemittance"("bookingId");
CREATE INDEX IF NOT EXISTS "ForeignRemittance_reportDueOn_idx" ON "ForeignRemittance"("reportDueOn");

CREATE TABLE IF NOT EXISTS "AdrCase" (
  "id" TEXT NOT NULL, "projectId" TEXT, "vendorId" TEXT, "bookingId" TEXT, "title" TEXT NOT NULL,
  "refNo" TEXT NOT NULL, "stage" "AdrStage" NOT NULL DEFAULT 'NOTICE_ISSUED', "claimant" TEXT NOT NULL,
  "respondent" TEXT NOT NULL, "arbitrator" TEXT, "claimAmount" DECIMAL(16,2), "nextHearingOn" TIMESTAMP(3),
  "settlementVoucherId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdrCase_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AdrCase_refNo_key" ON "AdrCase"("refNo");
CREATE INDEX IF NOT EXISTS "AdrCase_projectId_idx" ON "AdrCase"("projectId");
CREATE INDEX IF NOT EXISTS "AdrCase_vendorId_idx" ON "AdrCase"("vendorId");
CREATE INDEX IF NOT EXISTS "AdrCase_stage_idx" ON "AdrCase"("stage");
CREATE INDEX IF NOT EXISTS "AdrCase_nextHearingOn_idx" ON "AdrCase"("nextHearingOn");

CREATE TABLE IF NOT EXISTS "AdrEvent" (
  "id" TEXT NOT NULL, "caseId" TEXT NOT NULL, "kind" TEXT NOT NULL, "note" TEXT,
  "occurredOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "AdrEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AdrEvent_caseId_idx" ON "AdrEvent"("caseId");

CREATE TABLE IF NOT EXISTS "EstampCertificate" (
  "id" TEXT NOT NULL, "bookingId" TEXT, "projectId" TEXT, "purpose" TEXT NOT NULL,
  "considerationInr" DECIMAL(16,2), "dutyInr" DECIMAL(14,2) NOT NULL, "certificateNo" TEXT,
  "status" "EstampStatus" NOT NULL DEFAULT 'REQUESTED', "providerRef" TEXT, "firstParty" TEXT, "secondParty" TEXT,
  "issuedOn" TIMESTAMP(3), "voucherId" TEXT, "webhookEventId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EstampCertificate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "EstampCertificate_certificateNo_key" ON "EstampCertificate"("certificateNo");
CREATE INDEX IF NOT EXISTS "EstampCertificate_bookingId_idx" ON "EstampCertificate"("bookingId");
CREATE INDEX IF NOT EXISTS "EstampCertificate_status_idx" ON "EstampCertificate"("status");

CREATE TABLE IF NOT EXISTS "LitigationEscalation" (
  "id" TEXT NOT NULL, "projectId" TEXT, "bookingId" TEXT, "parentMatterId" TEXT, "forum" "LitForum" NOT NULL,
  "caseNo" TEXT, "title" TEXT NOT NULL, "status" "LitStatus" NOT NULL DEFAULT 'FILED', "counselName" TEXT,
  "counselAssignedOn" TIMESTAMP(3), "interimOrder" TEXT, "reliefSought" TEXT, "disputedInr" DECIMAL(16,2),
  "nextHearingOn" TIMESTAMP(3), "filedOn" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LitigationEscalation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "LitigationEscalation_projectId_idx" ON "LitigationEscalation"("projectId");
CREATE INDEX IF NOT EXISTS "LitigationEscalation_forum_idx" ON "LitigationEscalation"("forum");
CREATE INDEX IF NOT EXISTS "LitigationEscalation_status_idx" ON "LitigationEscalation"("status");
CREATE INDEX IF NOT EXISTS "LitigationEscalation_nextHearingOn_idx" ON "LitigationEscalation"("nextHearingOn");

-- Foreign keys
DO $$ BEGIN ALTER TABLE "NriComplianceProfile" ADD CONSTRAINT "NriComplianceProfile_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "ForeignRemittance" ADD CONSTRAINT "ForeignRemittance_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "NriComplianceProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "AdrCase" ADD CONSTRAINT "AdrCase_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "AdrCase" ADD CONSTRAINT "AdrCase_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "AdrEvent" ADD CONSTRAINT "AdrEvent_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "AdrCase"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "EstampCertificate" ADD CONSTRAINT "EstampCertificate_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "EstampCertificate" ADD CONSTRAINT "EstampCertificate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "LitigationEscalation" ADD CONSTRAINT "LitigationEscalation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "LitigationEscalation" ADD CONSTRAINT "LitigationEscalation_parentMatterId_fkey" FOREIGN KEY ("parentMatterId") REFERENCES "LitigationEscalation"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
