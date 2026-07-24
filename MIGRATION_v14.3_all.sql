-- MIGRATION v14.3 — Batches 13 (Land, title & approvals) and 4 (Cash flow & treasury)
-- Idempotent: safe to run more than once. Adds 13 tables and their enums/indexes/FKs.
-- You do NOT normally need to run this by hand — the in-app "Fix it now" repair
-- button applies the same DDL through the app's own database connection. This
-- file exists for the record and for a manual Neon run if you prefer.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LandParcelStage') THEN
    CREATE TYPE "LandParcelStage" AS ENUM ('IDENTIFIED', 'UNDER_NEGOTIATION', 'AGREED', 'DUE_DILIGENCE', 'REGISTERED', 'DROPPED');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TitleDocKind') THEN
    CREATE TYPE "TitleDocKind" AS ENUM ('MOTHER_DEED', 'SALE_DEED', 'GIFT_DEED', 'PARTITION_DEED', 'ENCUMBRANCE_CERTIFICATE', 'KHATA', 'CONVERSION_ORDER', 'POWER_OF_ATTORNEY', 'COURT_ORDER', 'OTHER');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'JdaShareType') THEN
    CREATE TYPE "JdaShareType" AS ENUM ('REVENUE_SHARE', 'AREA_SHARE');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RevenueRecordKind') THEN
    CREATE TYPE "RevenueRecordKind" AS ENUM ('KHATA', 'PATTA', 'CHITTA', 'DC_CONVERSION', 'BETTERMENT', 'PROPERTY_TAX', 'OTHER');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SanctionStatus') THEN
    CREATE TYPE "SanctionStatus" AS ENUM ('NOT_STARTED', 'APPLIED', 'IN_PROCESS', 'QUERY_RAISED', 'APPROVED', 'REJECTED', 'EXPIRED');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LitigationStatus') THEN
    CREATE TYPE "LitigationStatus" AS ENUM ('OPEN', 'HEARING', 'RESERVED', 'DISPOSED', 'APPEAL', 'CLOSED');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BankLineStatus') THEN
    CREATE TYPE "BankLineStatus" AS ENUM ('UNMATCHED', 'MATCHED', 'IGNORED');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LoanKind') THEN
    CREATE TYPE "LoanKind" AS ENUM ('TERM_LOAN', 'OVERDRAFT', 'VENTURE_DEBT', 'PROJECT_LOAN', 'OTHER');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LoanEventKind') THEN
    CREATE TYPE "LoanEventKind" AS ENUM ('DRAWDOWN', 'REPAYMENT', 'INTEREST', 'FEE');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "LandParcel" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "name" TEXT NOT NULL,
    "surveyNumber" TEXT,
    "village" TEXT,
    "taluk" TEXT,
    "district" TEXT,
    "state" TEXT NOT NULL DEFAULT 'Karnataka',
    "extentAcre" DECIMAL(12,4),
    "extentGuntha" DECIMAL(12,3),
    "ownerName" TEXT,
    "askingRate" DECIMAL(16,2),
    "agreedRate" DECIMAL(16,2),
    "stage" "LandParcelStage" NOT NULL DEFAULT 'IDENTIFIED',
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LandParcel_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TitleDocument" (
    "id" TEXT NOT NULL,
    "parcelId" TEXT NOT NULL,
    "kind" "TitleDocKind" NOT NULL DEFAULT 'OTHER',
    "title" TEXT NOT NULL,
    "chainOrder" INTEGER NOT NULL DEFAULT 0,
    "fromParty" TEXT,
    "toParty" TEXT,
    "documentDate" TIMESTAMP(3),
    "registrationNo" TEXT,
    "documentId" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TitleDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "JointDevelopmentAgreement" (
    "id" TEXT NOT NULL,
    "parcelId" TEXT NOT NULL,
    "landownerName" TEXT NOT NULL,
    "shareType" "JdaShareType" NOT NULL DEFAULT 'AREA_SHARE',
    "developerShare" DECIMAL(6,3),
    "landownerShare" DECIMAL(6,3),
    "refundableDeposit" DECIMAL(16,2),
    "signedOn" TIMESTAMP(3),
    "obligations" TEXT,
    "documentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JointDevelopmentAgreement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RevenueRecord" (
    "id" TEXT NOT NULL,
    "parcelId" TEXT NOT NULL,
    "kind" "RevenueRecordKind" NOT NULL DEFAULT 'OTHER',
    "reference" TEXT,
    "authority" TEXT,
    "paidToDate" TIMESTAMP(3),
    "amount" DECIMAL(16,2),
    "documentId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RevenueRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ApprovalSanction" (
    "id" TEXT NOT NULL,
    "parcelId" TEXT,
    "projectId" TEXT,
    "authority" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "SanctionStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "appliedOn" TIMESTAMP(3),
    "expectedOn" TIMESTAMP(3),
    "approvedOn" TIMESTAMP(3),
    "expiresOn" TIMESTAMP(3),
    "feePaid" DECIMAL(16,2),
    "currentDesk" TEXT,
    "referenceNo" TEXT,
    "documentId" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ApprovalSanction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LiaisonLog" (
    "id" TEXT NOT NULL,
    "approvalId" TEXT NOT NULL,
    "chasedBy" TEXT,
    "metWith" TEXT,
    "note" TEXT NOT NULL,
    "chasedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LiaisonLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LitigationMatter" (
    "id" TEXT NOT NULL,
    "parcelId" TEXT,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "court" TEXT,
    "caseNumber" TEXT,
    "counsel" TEXT,
    "status" "LitigationStatus" NOT NULL DEFAULT 'OPEN',
    "nextHearing" TIMESTAMP(3),
    "exposure" DECIMAL(16,2),
    "summary" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LitigationMatter_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PowerOfAttorney" (
    "id" TEXT NOT NULL,
    "parcelId" TEXT,
    "projectId" TEXT,
    "grantor" TEXT NOT NULL,
    "attorney" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "documentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PowerOfAttorney_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "BankAccount" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountLast4" TEXT,
    "ifsc" TEXT,
    "openingBalance" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "projectId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "BankStatementImport" (
    "id" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "fileName" TEXT,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "matchedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "importedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BankStatementImport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "BankStatementLine" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "txnDate" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "refNo" TEXT,
    "amount" DECIMAL(16,2) NOT NULL,
    "balance" DECIMAL(16,2),
    "status" "BankLineStatus" NOT NULL DEFAULT 'UNMATCHED',
    "matchedVoucherId" TEXT,
    "matchConfidence" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BankStatementLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LoanFacility" (
    "id" TEXT NOT NULL,
    "lender" TEXT NOT NULL,
    "kind" "LoanKind" NOT NULL DEFAULT 'TERM_LOAN',
    "sanctionedAmount" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "interestRate" DECIMAL(6,3),
    "projectId" TEXT,
    "startedOn" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LoanFacility_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LoanEvent" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "kind" "LoanEventKind" NOT NULL,
    "amount" DECIMAL(16,2) NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    CONSTRAINT "LoanEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LandParcel_projectId_idx" ON "LandParcel"("projectId");

CREATE INDEX IF NOT EXISTS "LandParcel_stage_idx" ON "LandParcel"("stage");

CREATE INDEX IF NOT EXISTS "TitleDocument_parcelId_chainOrder_idx" ON "TitleDocument"("parcelId", "chainOrder");

CREATE INDEX IF NOT EXISTS "JointDevelopmentAgreement_parcelId_idx" ON "JointDevelopmentAgreement"("parcelId");

CREATE INDEX IF NOT EXISTS "RevenueRecord_parcelId_kind_idx" ON "RevenueRecord"("parcelId", "kind");

CREATE INDEX IF NOT EXISTS "ApprovalSanction_parcelId_idx" ON "ApprovalSanction"("parcelId");

CREATE INDEX IF NOT EXISTS "ApprovalSanction_projectId_status_idx" ON "ApprovalSanction"("projectId", "status");

CREATE INDEX IF NOT EXISTS "ApprovalSanction_status_expectedOn_idx" ON "ApprovalSanction"("status", "expectedOn");

CREATE INDEX IF NOT EXISTS "LiaisonLog_approvalId_chasedOn_idx" ON "LiaisonLog"("approvalId", "chasedOn");

CREATE INDEX IF NOT EXISTS "LitigationMatter_projectId_status_idx" ON "LitigationMatter"("projectId", "status");

CREATE INDEX IF NOT EXISTS "LitigationMatter_status_nextHearing_idx" ON "LitigationMatter"("status", "nextHearing");

CREATE INDEX IF NOT EXISTS "PowerOfAttorney_projectId_idx" ON "PowerOfAttorney"("projectId");

CREATE INDEX IF NOT EXISTS "PowerOfAttorney_validUntil_idx" ON "PowerOfAttorney"("validUntil");

CREATE INDEX IF NOT EXISTS "BankAccount_projectId_idx" ON "BankAccount"("projectId");

CREATE INDEX IF NOT EXISTS "BankStatementImport_bankAccountId_idx" ON "BankStatementImport"("bankAccountId");

CREATE INDEX IF NOT EXISTS "BankStatementLine_bankAccountId_txnDate_idx" ON "BankStatementLine"("bankAccountId", "txnDate");

CREATE INDEX IF NOT EXISTS "BankStatementLine_status_idx" ON "BankStatementLine"("status");

CREATE INDEX IF NOT EXISTS "BankStatementLine_matchedVoucherId_idx" ON "BankStatementLine"("matchedVoucherId");

CREATE INDEX IF NOT EXISTS "LoanFacility_projectId_idx" ON "LoanFacility"("projectId");

CREATE INDEX IF NOT EXISTS "LoanEvent_loanId_eventDate_idx" ON "LoanEvent"("loanId", "eventDate");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TitleDocument_parcelId_fkey') THEN
    ALTER TABLE "TitleDocument" ADD CONSTRAINT "TitleDocument_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "LandParcel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'JointDevelopmentAgreement_parcelId_fkey') THEN
    ALTER TABLE "JointDevelopmentAgreement" ADD CONSTRAINT "JointDevelopmentAgreement_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "LandParcel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RevenueRecord_parcelId_fkey') THEN
    ALTER TABLE "RevenueRecord" ADD CONSTRAINT "RevenueRecord_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "LandParcel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ApprovalSanction_parcelId_fkey') THEN
    ALTER TABLE "ApprovalSanction" ADD CONSTRAINT "ApprovalSanction_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "LandParcel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LiaisonLog_approvalId_fkey') THEN
    ALTER TABLE "LiaisonLog" ADD CONSTRAINT "LiaisonLog_approvalId_fkey" FOREIGN KEY ("approvalId") REFERENCES "ApprovalSanction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BankStatementImport_bankAccountId_fkey') THEN
    ALTER TABLE "BankStatementImport" ADD CONSTRAINT "BankStatementImport_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BankStatementLine_importId_fkey') THEN
    ALTER TABLE "BankStatementLine" ADD CONSTRAINT "BankStatementLine_importId_fkey" FOREIGN KEY ("importId") REFERENCES "BankStatementImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BankStatementLine_bankAccountId_fkey') THEN
    ALTER TABLE "BankStatementLine" ADD CONSTRAINT "BankStatementLine_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LoanEvent_loanId_fkey') THEN
    ALTER TABLE "LoanEvent" ADD CONSTRAINT "LoanEvent_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "LoanFacility"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
