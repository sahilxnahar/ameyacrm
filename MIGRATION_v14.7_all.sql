-- MIGRATION v14.7 — Batch 16 (Capital, investors & RERA escrow)
-- Idempotent. Adds Investor, InvestorTransaction, CapitalStackEntry,
-- EscrowMovement, LoanCovenant and their enums/indexes/FKs. Or use the repair button.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InvestorTxnKind') THEN
    CREATE TYPE "InvestorTxnKind" AS ENUM ('COMMITMENT', 'DRAWDOWN', 'DISTRIBUTION', 'REPAYMENT');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CapitalKind') THEN
    CREATE TYPE "CapitalKind" AS ENUM ('EQUITY', 'DEBT', 'BUYER_ADVANCE', 'MEZZANINE', 'OTHER');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EscrowMovementKind') THEN
    CREATE TYPE "EscrowMovementKind" AS ENUM ('DEPOSIT', 'WITHDRAWAL');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CovenantDirection') THEN
    CREATE TYPE "CovenantDirection" AS ENUM ('MIN', 'MAX');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "Investor" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "name" TEXT NOT NULL,
    "contact" TEXT,
    "commitment" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Investor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "InvestorTransaction" (
    "id" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "kind" "InvestorTxnKind" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "unitsAllotted" INTEGER,
    "txnDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    CONSTRAINT "InvestorTransaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CapitalStackEntry" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" "CapitalKind" NOT NULL DEFAULT 'EQUITY',
    "source" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "costPct" DECIMAL(6,3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CapitalStackEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EscrowMovement" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" "EscrowMovementKind" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "certifiedPct" DECIMAL(5,2),
    "reference" TEXT,
    "note" TEXT,
    "movementDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EscrowMovement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LoanCovenant" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "loanRef" TEXT,
    "name" TEXT NOT NULL,
    "direction" "CovenantDirection" NOT NULL DEFAULT 'MIN',
    "threshold" DECIMAL(12,4) NOT NULL,
    "current" DECIMAL(12,4) NOT NULL,
    "unit" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LoanCovenant_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Investor_projectId_idx" ON "Investor"("projectId");

CREATE INDEX IF NOT EXISTS "InvestorTransaction_investorId_txnDate_idx" ON "InvestorTransaction"("investorId", "txnDate");

CREATE INDEX IF NOT EXISTS "CapitalStackEntry_projectId_kind_idx" ON "CapitalStackEntry"("projectId", "kind");

CREATE INDEX IF NOT EXISTS "EscrowMovement_projectId_movementDate_idx" ON "EscrowMovement"("projectId", "movementDate");

CREATE INDEX IF NOT EXISTS "LoanCovenant_projectId_idx" ON "LoanCovenant"("projectId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InvestorTransaction_investorId_fkey') THEN
    ALTER TABLE "InvestorTransaction" ADD CONSTRAINT "InvestorTransaction_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "Investor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
