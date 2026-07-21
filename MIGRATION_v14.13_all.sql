-- MIGRATION v14.13 — Six batches: Variations(28), Expenses(15), Association CAM(19),
-- Transmittals(17), Walk-ins(21), Commercial leasing(20). Idempotent. 6 tables.
-- Or use the in-app repair button.

CREATE TABLE IF NOT EXISTS "VariationOrder" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "bookingRef" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'RAISED',
    "raisedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VariationOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ExpenseClaim" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "claimant" TEXT NOT NULL,
    "category" TEXT,
    "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "incurredOn" TIMESTAMP(3),
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExpenseClaim_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MaintenanceCharge" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "unitCode" TEXT NOT NULL,
    "period" TEXT,
    "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'RAISED',
    "dueOn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MaintenanceCharge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DrawingTransmittal" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "drawingRef" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "revision" TEXT,
    "issuedTo" TEXT NOT NULL,
    "issuedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DrawingTransmittal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WalkIn" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "source" TEXT,
    "visitedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "outcome" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WalkIn_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CommercialTenancy" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "unitCode" TEXT NOT NULL,
    "tenant" TEXT NOT NULL,
    "areaSqft" DECIMAL(12,2),
    "monthlyRent" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "escalationPct" DECIMAL(6,3),
    "startsOn" TIMESTAMP(3),
    "endsOn" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CommercialTenancy_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "VariationOrder_projectId_status_idx" ON "VariationOrder"("projectId", "status");

CREATE INDEX IF NOT EXISTS "ExpenseClaim_status_idx" ON "ExpenseClaim"("status");

CREATE INDEX IF NOT EXISTS "MaintenanceCharge_projectId_status_idx" ON "MaintenanceCharge"("projectId", "status");

CREATE INDEX IF NOT EXISTS "DrawingTransmittal_projectId_idx" ON "DrawingTransmittal"("projectId");

CREATE INDEX IF NOT EXISTS "WalkIn_projectId_visitedOn_idx" ON "WalkIn"("projectId", "visitedOn");

CREATE INDEX IF NOT EXISTS "CommercialTenancy_status_idx" ON "CommercialTenancy"("status");
