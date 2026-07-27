-- Ameya Heights CRM — migration for v15.59 (Land & Title registers)
-- Modules 84 (Title Chain Vault), 85 (JDA Heir Mapper), 88 (Land Conversion).
-- Idempotent: safe to re-run. Run in Neon before deploying v15.59.

DO $$ BEGIN CREATE TYPE "LinkDocKind" AS ENUM ('MOTHER_DEED','SALE_DEED','GIFT_DEED','PARTITION_DEED','MUTATION_EXTRACT','ENCUMBRANCE_CERT','RTC_PAHANI','CONVERSION_ORDER','WILL','COURT_DECREE','OTHER'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "ConversionStage" AS ENUM ('APPLIED','RTC_VERIFIED','DC_SCRUTINY','FEE_DEMANDED','FEE_PAID','DC_ORDER_ISSUED','KHATA_UPDATED','REJECTED'); EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "TitleChainEntry" (
  "id" TEXT NOT NULL, "projectId" TEXT, "landParcelId" TEXT, "kind" "LinkDocKind" NOT NULL,
  "fromParty" TEXT, "toParty" TEXT, "documentNo" TEXT, "registeredOn" TIMESTAMP(3), "sroOffice" TEXT,
  "periodFrom" INTEGER, "periodTo" INTEGER, "documentId" TEXT, "isVerified" BOOLEAN NOT NULL DEFAULT false,
  "remarks" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TitleChainEntry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "TitleChainEntry_projectId_idx" ON "TitleChainEntry"("projectId");
CREATE INDEX IF NOT EXISTS "TitleChainEntry_landParcelId_idx" ON "TitleChainEntry"("landParcelId");
CREATE INDEX IF NOT EXISTS "TitleChainEntry_kind_idx" ON "TitleChainEntry"("kind");
CREATE INDEX IF NOT EXISTS "TitleChainEntry_registeredOn_idx" ON "TitleChainEntry"("registeredOn");

CREATE TABLE IF NOT EXISTS "Landowner" (
  "id" TEXT NOT NULL, "projectId" TEXT, "name" TEXT NOT NULL, "relationToRoot" TEXT, "parentId" TEXT,
  "isDeceased" BOOLEAN NOT NULL DEFAULT false, "shareNum" INTEGER, "shareDen" INTEGER,
  "relinquished" BOOLEAN NOT NULL DEFAULT false, "relinquishDeedNo" TEXT, "relinquishOn" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Landowner_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Landowner_projectId_idx" ON "Landowner"("projectId");
CREATE INDEX IF NOT EXISTS "Landowner_parentId_idx" ON "Landowner"("parentId");

CREATE TABLE IF NOT EXISTS "LandConversion" (
  "id" TEXT NOT NULL, "projectId" TEXT, "landParcelId" TEXT, "surveyNo" TEXT NOT NULL, "village" TEXT,
  "taluk" TEXT, "extentAcres" DECIMAL(12,4), "fromUse" TEXT NOT NULL DEFAULT 'AGRICULTURAL',
  "toUse" TEXT NOT NULL DEFAULT 'RESIDENTIAL', "stage" "ConversionStage" NOT NULL DEFAULT 'APPLIED',
  "dcOrderNo" TEXT, "conversionFee" DECIMAL(16,2), "feeVoucherId" TEXT, "appliedOn" TIMESTAMP(3),
  "orderOn" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LandConversion_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "LandConversion_projectId_idx" ON "LandConversion"("projectId");
CREATE INDEX IF NOT EXISTS "LandConversion_stage_idx" ON "LandConversion"("stage");

-- Foreign keys (project link; heir tree self-ref)
DO $$ BEGIN ALTER TABLE "TitleChainEntry" ADD CONSTRAINT "TitleChainEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "Landowner" ADD CONSTRAINT "Landowner_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "Landowner" ADD CONSTRAINT "Landowner_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Landowner"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "LandConversion" ADD CONSTRAINT "LandConversion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
