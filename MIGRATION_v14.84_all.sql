-- Ameya Heights CRM — migration for v14.84 (Batch 3: Home-loan tracking)
-- Idempotent: safe to run more than once. Run this in Neon before deploying v14.84.

DO $$ BEGIN
  CREATE TYPE "HomeLoanStatus" AS ENUM ('ENQUIRY', 'APPLIED', 'SANCTIONED', 'DISBURSED_PARTIAL', 'DISBURSED_FULL', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "HomeLoan" (
    "id" TEXT NOT NULL,
    "customerId" TEXT,
    "bookingId" TEXT,
    "buyerName" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "applicationRef" TEXT,
    "loanAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "sanctionedAmount" DECIMAL(14,2),
    "disbursedAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "HomeLoanStatus" NOT NULL DEFAULT 'ENQUIRY',
    "nocIssued" BOOLEAN NOT NULL DEFAULT false,
    "tripartiteSigned" BOOLEAN NOT NULL DEFAULT false,
    "sanctionDate" TIMESTAMP(3),
    "notes" TEXT,
    "projectId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HomeLoan_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "HomeLoan_status_idx" ON "HomeLoan"("status");
CREATE INDEX IF NOT EXISTS "HomeLoan_customerId_idx" ON "HomeLoan"("customerId");
CREATE INDEX IF NOT EXISTS "HomeLoan_projectId_idx" ON "HomeLoan"("projectId");
