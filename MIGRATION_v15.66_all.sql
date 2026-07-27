-- Ameya Heights CRM — migration for v15.66 (Modules #66 Piece-Rate, #69 Default Registry)
-- Idempotent: safe to re-run. Run in Neon before deploying v15.66.
-- Piece-rate billing settles onto a Voucher; the default registry is cross-project.

CREATE TABLE IF NOT EXISTS "PieceRateEntry" (
  "id" TEXT NOT NULL, "projectId" TEXT NOT NULL, "vendorId" TEXT, "workItem" TEXT NOT NULL,
  "unit" TEXT NOT NULL DEFAULT 'SQFT', "quantity" DECIMAL(14,3) NOT NULL, "ratePerUnit" DECIMAL(10,2) NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL, "measuredOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "voucherId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "PieceRateEntry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PieceRateEntry_projectId_idx" ON "PieceRateEntry"("projectId");
CREATE INDEX IF NOT EXISTS "PieceRateEntry_vendorId_idx" ON "PieceRateEntry"("vendorId");

CREATE TABLE IF NOT EXISTS "VendorDefault" (
  "id" TEXT NOT NULL, "vendorId" TEXT NOT NULL, "projectId" TEXT, "kind" TEXT NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'MEDIUM', "note" TEXT, "reportedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VendorDefault_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "VendorDefault_vendorId_idx" ON "VendorDefault"("vendorId");
CREATE INDEX IF NOT EXISTS "VendorDefault_severity_idx" ON "VendorDefault"("severity");

DO $$ BEGIN ALTER TABLE "PieceRateEntry" ADD CONSTRAINT "PieceRateEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "VendorDefault" ADD CONSTRAINT "VendorDefault_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
