-- Ameya Heights CRM — migration for v15.58 (Structural CLM #82 + NCLT Monitor #87)
-- Idempotent: safe to re-run. Run in Neon before deploying v15.58.
--
-- Two payment-control modules of the Legal group: the independent-engineer
-- certification gate on structural contracts, and the IBC/NCLT advance freeze.
-- Both are enforced server-side in the RA-bill settlement action.

DO $$ BEGIN CREATE TYPE "StructuralContractStatus" AS ENUM ('DRAFT','ACTIVE','SUSPENDED','EXPIRED','TERMINATED','CLOSED'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "InsolvencyStage" AS ENUM ('FLAGGED','CIRP_ADMITTED','MORATORIUM','RESOLUTION','LIQUIDATION','CLOSED'); EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "StructuralContract" (
  "id" TEXT NOT NULL, "projectId" TEXT NOT NULL, "vendorId" TEXT NOT NULL, "title" TEXT NOT NULL,
  "contractNo" TEXT NOT NULL, "status" "StructuralContractStatus" NOT NULL DEFAULT 'DRAFT',
  "liabilityClause" TEXT, "defectLiabilityEnd" TIMESTAMP(3), "dailyReportReqd" BOOLEAN NOT NULL DEFAULT true,
  "startOn" TIMESTAMP(3), "endOn" TIMESTAMP(3), "value" DECIMAL(16,2),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StructuralContract_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "StructuralContract_contractNo_key" ON "StructuralContract"("contractNo");
CREATE INDEX IF NOT EXISTS "StructuralContract_projectId_idx" ON "StructuralContract"("projectId");
CREATE INDEX IF NOT EXISTS "StructuralContract_vendorId_idx" ON "StructuralContract"("vendorId");
CREATE INDEX IF NOT EXISTS "StructuralContract_status_idx" ON "StructuralContract"("status");
CREATE INDEX IF NOT EXISTS "StructuralContract_endOn_idx" ON "StructuralContract"("endOn");

CREATE TABLE IF NOT EXISTS "EngineerCertification" (
  "id" TEXT NOT NULL, "contractId" TEXT NOT NULL, "vendorId" TEXT NOT NULL, "period" TEXT NOT NULL,
  "certifiedById" TEXT, "certifiedAt" TIMESTAMP(3), "isCleared" BOOLEAN NOT NULL DEFAULT false,
  "remarks" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EngineerCertification_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "EngineerCertification_contractId_period_key" ON "EngineerCertification"("contractId","period");
CREATE INDEX IF NOT EXISTS "EngineerCertification_vendorId_idx" ON "EngineerCertification"("vendorId");
CREATE INDEX IF NOT EXISTS "EngineerCertification_isCleared_idx" ON "EngineerCertification"("isCleared");

CREATE TABLE IF NOT EXISTS "VendorInsolvencyCase" (
  "id" TEXT NOT NULL, "vendorId" TEXT NOT NULL, "stage" "InsolvencyStage" NOT NULL DEFAULT 'FLAGGED',
  "ncltBench" TEXT, "cirpRef" TEXT, "irpName" TEXT, "admittedOn" TIMESTAMP(3),
  "freezeAdvances" BOOLEAN NOT NULL DEFAULT true, "claimFiledInr" DECIMAL(16,2), "claimFiledOn" TIMESTAMP(3),
  "remarks" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VendorInsolvencyCase_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "VendorInsolvencyCase_vendorId_idx" ON "VendorInsolvencyCase"("vendorId");
CREATE INDEX IF NOT EXISTS "VendorInsolvencyCase_stage_idx" ON "VendorInsolvencyCase"("stage");

-- Foreign keys
DO $$ BEGIN ALTER TABLE "StructuralContract" ADD CONSTRAINT "StructuralContract_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "StructuralContract" ADD CONSTRAINT "StructuralContract_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "EngineerCertification" ADD CONSTRAINT "EngineerCertification_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "StructuralContract"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "VendorInsolvencyCase" ADD CONSTRAINT "VendorInsolvencyCase_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
