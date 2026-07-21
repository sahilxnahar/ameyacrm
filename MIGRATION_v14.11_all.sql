-- MIGRATION v14.11 — Batch 7 (Sales: unit pricing & broker commission)
-- Idempotent. Adds UnitPricing and CommissionPayout (+ CommissionStatus enum).
-- Or use the in-app repair button.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CommissionStatus') THEN
    CREATE TYPE "CommissionStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID', 'CANCELLED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "UnitPricing" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "projectId" TEXT,
    "baseRatePerSqft" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "baseFloor" INTEGER NOT NULL DEFAULT 0,
    "floorRisePerSqft" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "plcPerSqft" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "viewPremiumPerSqft" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "lumpSum" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UnitPricing_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CommissionPayout" (
    "id" TEXT NOT NULL,
    "channelPartnerId" TEXT NOT NULL,
    "bookingId" TEXT,
    "projectId" TEXT,
    "bookingValue" DECIMAL(18,2) NOT NULL,
    "ratePct" DECIMAL(6,3) NOT NULL,
    "grossCommission" DECIMAL(16,2) NOT NULL,
    "tdsAmount" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "netPayable" DECIMAL(16,2) NOT NULL,
    "status" "CommissionStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "paidOn" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CommissionPayout_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UnitPricing_unitId_key" ON "UnitPricing"("unitId");

CREATE INDEX IF NOT EXISTS "UnitPricing_projectId_idx" ON "UnitPricing"("projectId");

CREATE INDEX IF NOT EXISTS "CommissionPayout_channelPartnerId_idx" ON "CommissionPayout"("channelPartnerId");

CREATE INDEX IF NOT EXISTS "CommissionPayout_status_idx" ON "CommissionPayout"("status");
