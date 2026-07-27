-- Ameya Heights CRM — migration for v15.53 (RA Bills + IE Certification + BOCW cess)
-- Idempotent: safe to re-run. Run in Neon before deploying v15.53.
--
-- Phase 1 of the construction ERP: contractor Running-Account bills certified by
-- the Independent Engineer through the existing approval engine, carrying the 1%
-- BOCW labour cess, retention and TDS, settled via a Voucher.

-- 1) new value on the shared approval-entity enum
ALTER TYPE "ApprovalEntity" ADD VALUE IF NOT EXISTS 'RA_BILL';

-- 2) RA-bill status enum
DO $$ BEGIN
  CREATE TYPE "RaBillStatus" AS ENUM ('DRAFT', 'PENDING', 'CERTIFIED', 'PAID', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 3) tables
CREATE TABLE IF NOT EXISTS "RaBill" (
  "id" TEXT NOT NULL, "number" TEXT NOT NULL, "billNo" INTEGER NOT NULL DEFAULT 1,
  "contractId" TEXT, "vendorId" TEXT, "projectId" TEXT, "periodFrom" TIMESTAMP(3), "periodTo" TIMESTAMP(3),
  "grossValue" DECIMAL(16,2) NOT NULL DEFAULT 0, "previousPaid" DECIMAL(16,2) NOT NULL DEFAULT 0,
  "deductions" DECIMAL(16,2) NOT NULL DEFAULT 0, "cessPercent" DECIMAL(5,2) NOT NULL DEFAULT 1,
  "cessAmount" DECIMAL(16,2) NOT NULL DEFAULT 0, "retentionPercent" DECIMAL(5,2) NOT NULL DEFAULT 5,
  "retentionAmount" DECIMAL(16,2) NOT NULL DEFAULT 0, "tdsSection" TEXT, "tdsRate" DECIMAL(5,2),
  "tdsAmount" DECIMAL(16,2) NOT NULL DEFAULT 0, "netPayable" DECIMAL(16,2) NOT NULL DEFAULT 0,
  "status" "RaBillStatus" NOT NULL DEFAULT 'DRAFT', "certifiedById" TEXT, "certifiedAt" TIMESTAMP(3),
  "voucherId" TEXT, "narration" TEXT, "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RaBill_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "RaBill_number_key" ON "RaBill"("number");
CREATE INDEX IF NOT EXISTS "RaBill_status_idx" ON "RaBill"("status");
CREATE INDEX IF NOT EXISTS "RaBill_vendorId_idx" ON "RaBill"("vendorId");
CREATE INDEX IF NOT EXISTS "RaBill_projectId_idx" ON "RaBill"("projectId");
CREATE INDEX IF NOT EXISTS "RaBill_contractId_idx" ON "RaBill"("contractId");

CREATE TABLE IF NOT EXISTS "RaBillLine" (
  "id" TEXT NOT NULL, "raBillId" TEXT NOT NULL, "description" TEXT NOT NULL, "unit" TEXT,
  "qty" DECIMAL(14,3) NOT NULL DEFAULT 0, "rate" DECIMAL(14,2) NOT NULL DEFAULT 0, "amount" DECIMAL(16,2) NOT NULL DEFAULT 0,
  CONSTRAINT "RaBillLine_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "RaBillLine_raBillId_idx" ON "RaBillLine"("raBillId");
