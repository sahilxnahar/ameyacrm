-- Ameya Heights CRM — migration for v15.61 (Group 10: Advanced Financial & Taxation)
-- Modules 51 (IND-AS 115 POCM), 52 (GSTR-2B recon), 53 (MSME 45-day), 54 (Khata/EC), 55 (Capital-gains).
-- Idempotent: safe to re-run. Run in Neon before deploying v15.61.

DO $$ BEGIN CREATE TYPE "GstMatchStatus" AS ENUM ('UNMATCHED','MATCHED','MISMATCH_AMOUNT','MISSING_IN_2B','MISSING_IN_BOOKS'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "MsmeClockStatus" AS ENUM ('ON_TIME','DUE_SOON','OVERDUE','DISALLOWED','PAID'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "KhataType" AS ENUM ('A_KHATA','B_KHATA','E_KHATA','NONE'); EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "RevenueRecognition" (
  "id" TEXT NOT NULL, "projectId" TEXT NOT NULL, "period" TEXT NOT NULL, "costToDate" DECIMAL(16,2) NOT NULL,
  "totalEstCost" DECIMAL(16,2) NOT NULL, "pocmPercent" DECIMAL(6,3) NOT NULL, "totalContractVal" DECIMAL(16,2) NOT NULL,
  "revenueToDate" DECIMAL(16,2) NOT NULL, "revenueThisPeriod" DECIMAL(16,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "RevenueRecognition_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "RevenueRecognition_projectId_period_key" ON "RevenueRecognition"("projectId","period");
CREATE INDEX IF NOT EXISTS "RevenueRecognition_projectId_idx" ON "RevenueRecognition"("projectId");

CREATE TABLE IF NOT EXISTS "Gstr2bLine" (
  "id" TEXT NOT NULL, "period" TEXT NOT NULL, "supplierGstin" TEXT NOT NULL, "invoiceNo" TEXT NOT NULL,
  "invoiceDate" TIMESTAMP(3), "taxableValue" DECIMAL(14,2) NOT NULL, "igst" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "cgst" DECIMAL(12,2) NOT NULL DEFAULT 0, "sgst" DECIMAL(12,2) NOT NULL DEFAULT 0, "vendorBillId" TEXT,
  "status" "GstMatchStatus" NOT NULL DEFAULT 'UNMATCHED', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Gstr2bLine_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Gstr2bLine_supplierGstin_invoiceNo_period_key" ON "Gstr2bLine"("supplierGstin","invoiceNo","period");
CREATE INDEX IF NOT EXISTS "Gstr2bLine_status_idx" ON "Gstr2bLine"("status");
CREATE INDEX IF NOT EXISTS "Gstr2bLine_vendorBillId_idx" ON "Gstr2bLine"("vendorBillId");

CREATE TABLE IF NOT EXISTS "MsmePaymentClock" (
  "id" TEXT NOT NULL, "vendorId" TEXT NOT NULL, "vendorBillId" TEXT NOT NULL, "udyamNo" TEXT,
  "billDate" TIMESTAMP(3) NOT NULL, "dueDate" TIMESTAMP(3) NOT NULL, "amount" DECIMAL(14,2) NOT NULL,
  "status" "MsmeClockStatus" NOT NULL DEFAULT 'ON_TIME', "paidVoucherId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MsmePaymentClock_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MsmePaymentClock_vendorBillId_key" ON "MsmePaymentClock"("vendorBillId");
CREATE INDEX IF NOT EXISTS "MsmePaymentClock_status_idx" ON "MsmePaymentClock"("status");
CREATE INDEX IF NOT EXISTS "MsmePaymentClock_dueDate_idx" ON "MsmePaymentClock"("dueDate");

CREATE TABLE IF NOT EXISTS "KhataRecord" (
  "id" TEXT NOT NULL, "projectId" TEXT, "unitId" TEXT, "khataType" "KhataType" NOT NULL DEFAULT 'NONE',
  "pid" TEXT, "khataNo" TEXT, "assessmentNo" TEXT, "ownerName" TEXT, "lastEcOn" TIMESTAMP(3),
  "ecClear" BOOLEAN NOT NULL DEFAULT false, "remarks" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "KhataRecord_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "KhataRecord_projectId_idx" ON "KhataRecord"("projectId");
CREATE INDEX IF NOT EXISTS "KhataRecord_unitId_idx" ON "KhataRecord"("unitId");
CREATE INDEX IF NOT EXISTS "KhataRecord_khataType_idx" ON "KhataRecord"("khataType");

CREATE TABLE IF NOT EXISTS "CapitalGainScenario" (
  "id" TEXT NOT NULL, "leadId" TEXT, "saleValue" DECIMAL(16,2) NOT NULL, "indexedCost" DECIMAL(16,2) NOT NULL,
  "section" TEXT NOT NULL, "reinvestAmount" DECIMAL(16,2) NOT NULL, "exemptGain" DECIMAL(16,2) NOT NULL,
  "taxSaved" DECIMAL(16,2) NOT NULL, "createdById" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CapitalGainScenario_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CapitalGainScenario_leadId_idx" ON "CapitalGainScenario"("leadId");

-- Foreign keys
DO $$ BEGIN ALTER TABLE "RevenueRecognition" ADD CONSTRAINT "RevenueRecognition_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "MsmePaymentClock" ADD CONSTRAINT "MsmePaymentClock_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "KhataRecord" ADD CONSTRAINT "KhataRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
