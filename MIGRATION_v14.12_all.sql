-- MIGRATION v14.12 — Seven batches: Feasibility(18), Statutory(3), Procurement(6),
-- Governance(22), Security ops(25), Institutional memory(29), Environment/ESG(23).
-- Idempotent. Adds 14 tables + their enums/indexes. Or use the in-app repair button.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ObligationKind') THEN
    CREATE TYPE "ObligationKind" AS ENUM ('GST', 'TDS', 'RERA', 'PF_ESI', 'PROFESSIONAL_TAX', 'INCOME_TAX', 'ROC', 'OTHER');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ObligationFrequency') THEN
    CREATE TYPE "ObligationFrequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'ANNUAL', 'ONE_TIME');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ObligationStatus') THEN
    CREATE TYPE "ObligationStatus" AS ENUM ('UPCOMING', 'DUE', 'FILED', 'OVERDUE');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RiskLevel') THEN
    CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RiskStatus') THEN
    CREATE TYPE "RiskStatus" AS ENUM ('OPEN', 'MITIGATING', 'MONITORED', 'CLOSED');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ContractStatus') THEN
    CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'ACTIVE', 'EXPIRING', 'EXPIRED', 'TERMINATED');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SecOpsSeverity') THEN
    CREATE TYPE "SecOpsSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SecIncidentStatus') THEN
    CREATE TYPE "SecIncidentStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'CONTAINED', 'RESOLVED');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SopStatus') THEN
    CREATE TYPE "SopStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EnvCondStatus') THEN
    CREATE TYPE "EnvCondStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLIED', 'BREACHED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "FeasibilityModel" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "name" TEXT NOT NULL,
    "landCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "constructionCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "financeCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "otherCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "saleableAreaSqft" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "salePricePerSqft" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "targetReturnPct" DECIMAL(6,3),
    "salePriceDeltaPct" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "costDeltaPct" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FeasibilityModel_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "StatutoryObligation" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "kind" "ObligationKind" NOT NULL DEFAULT 'OTHER',
    "authority" TEXT,
    "frequency" "ObligationFrequency" NOT NULL DEFAULT 'MONTHLY',
    "owner" TEXT,
    "nextDue" TIMESTAMP(3),
    "lastFiled" TIMESTAMP(3),
    "status" "ObligationStatus" NOT NULL DEFAULT 'UPCOMING',
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StatutoryObligation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ComplianceDocExpiry" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "category" TEXT,
    "reference" TEXT,
    "expiresOn" TIMESTAMP(3),
    "owner" TEXT,
    "renewed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ComplianceDocExpiry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GoodsReceipt" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "grnNumber" TEXT,
    "vendorName" TEXT NOT NULL,
    "materialName" TEXT NOT NULL,
    "poReference" TEXT,
    "unit" TEXT,
    "orderedQty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "receivedQty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "billedQty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "rate" DECIMAL(14,2),
    "note" TEXT,
    "receivedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GoodsReceipt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RiskEntry" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "category" TEXT,
    "likelihood" "RiskLevel" NOT NULL DEFAULT 'MEDIUM',
    "impact" "RiskLevel" NOT NULL DEFAULT 'MEDIUM',
    "owner" TEXT,
    "mitigation" TEXT,
    "status" "RiskStatus" NOT NULL DEFAULT 'OPEN',
    "reviewOn" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RiskEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ContractRecord" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "counterparty" TEXT NOT NULL,
    "kind" TEXT,
    "value" DECIMAL(18,2),
    "startsOn" TIMESTAMP(3),
    "endsOn" TIMESTAMP(3),
    "renewalOn" TIMESTAMP(3),
    "obligations" TEXT,
    "status" "ContractStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ContractRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "InsurancePolicy" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "name" TEXT NOT NULL,
    "insurer" TEXT NOT NULL,
    "policyNo" TEXT,
    "cover" DECIMAL(18,2),
    "premium" DECIMAL(16,2),
    "expiresOn" TIMESTAMP(3),
    "claims" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InsurancePolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SecurityIncident" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "severity" "SecOpsSeverity" NOT NULL DEFAULT 'MEDIUM',
    "kind" TEXT,
    "detectedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "SecIncidentStatus" NOT NULL DEFAULT 'OPEN',
    "rootCause" TEXT,
    "resolvedOn" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SecurityIncident_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AccessReview" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "scope" TEXT,
    "reviewer" TEXT,
    "dueOn" TIMESTAMP(3),
    "completedOn" TIMESTAMP(3),
    "findings" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccessReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Sop" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "department" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "ownerId" TEXT,
    "content" TEXT,
    "effectiveOn" TIMESTAMP(3),
    "status" "SopStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Sop_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DecisionLog" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "decidedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedBy" TEXT,
    "context" TEXT,
    "decision" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DecisionLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LessonLearned" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "category" TEXT,
    "situation" TEXT,
    "recommendation" TEXT NOT NULL,
    "capturedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LessonLearned_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EnvClearanceCondition" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "condition" TEXT NOT NULL,
    "authority" TEXT,
    "evidence" TEXT,
    "dueOn" TIMESTAMP(3),
    "status" "EnvCondStatus" NOT NULL DEFAULT 'PENDING',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EnvClearanceCondition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WasteManifest" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "manifestNo" TEXT,
    "wasteType" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "unit" TEXT,
    "disposedTo" TEXT,
    "disposedOn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WasteManifest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "FeasibilityModel_projectId_idx" ON "FeasibilityModel"("projectId");

CREATE INDEX IF NOT EXISTS "StatutoryObligation_projectId_status_idx" ON "StatutoryObligation"("projectId", "status");

CREATE INDEX IF NOT EXISTS "StatutoryObligation_nextDue_idx" ON "StatutoryObligation"("nextDue");

CREATE INDEX IF NOT EXISTS "ComplianceDocExpiry_expiresOn_idx" ON "ComplianceDocExpiry"("expiresOn");

CREATE INDEX IF NOT EXISTS "GoodsReceipt_projectId_idx" ON "GoodsReceipt"("projectId");

CREATE INDEX IF NOT EXISTS "RiskEntry_projectId_status_idx" ON "RiskEntry"("projectId", "status");

CREATE INDEX IF NOT EXISTS "ContractRecord_status_idx" ON "ContractRecord"("status");

CREATE INDEX IF NOT EXISTS "ContractRecord_renewalOn_idx" ON "ContractRecord"("renewalOn");

CREATE INDEX IF NOT EXISTS "InsurancePolicy_expiresOn_idx" ON "InsurancePolicy"("expiresOn");

CREATE INDEX IF NOT EXISTS "SecurityIncident_status_idx" ON "SecurityIncident"("status");

CREATE INDEX IF NOT EXISTS "AccessReview_dueOn_idx" ON "AccessReview"("dueOn");

CREATE INDEX IF NOT EXISTS "Sop_status_idx" ON "Sop"("status");

CREATE INDEX IF NOT EXISTS "DecisionLog_projectId_idx" ON "DecisionLog"("projectId");

CREATE INDEX IF NOT EXISTS "LessonLearned_projectId_idx" ON "LessonLearned"("projectId");

CREATE INDEX IF NOT EXISTS "EnvClearanceCondition_projectId_status_idx" ON "EnvClearanceCondition"("projectId", "status");

CREATE INDEX IF NOT EXISTS "WasteManifest_projectId_idx" ON "WasteManifest"("projectId");
