-- Ameya Heights CRM — migration for v15.54 (EPF/ESI compliance gate)
-- Idempotent: safe to re-run. Run in Neon before deploying v15.54.
--
-- Phase 1 of the construction ERP: a reusable document-gate. Labour vendors can
-- be flagged so their RA-bill payments are blocked until the month's EPF & ESI
-- challans are recorded and verified.

ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "requiresLabourCompliance" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "ComplianceDoc" (
  "id" TEXT NOT NULL, "vendorId" TEXT NOT NULL, "kind" TEXT NOT NULL, "periodMonth" TEXT NOT NULL,
  "challanNo" TEXT, "amount" DECIMAL(14,2), "status" TEXT NOT NULL DEFAULT 'PENDING', "fileId" TEXT, "note" TEXT,
  "uploadedById" TEXT, "verifiedById" TEXT, "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ComplianceDoc_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ComplianceDoc_vendorId_kind_periodMonth_key" ON "ComplianceDoc"("vendorId","kind","periodMonth");
CREATE INDEX IF NOT EXISTS "ComplianceDoc_vendorId_idx" ON "ComplianceDoc"("vendorId");
CREATE INDEX IF NOT EXISTS "ComplianceDoc_status_idx" ON "ComplianceDoc"("status");
