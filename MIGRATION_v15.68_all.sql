-- Ameya Heights CRM — migration for v15.68 (Module #68: EPF/ESI UAN Bulk Validator)
-- Idempotent: safe to re-run. Run in Neon before deploying v15.68.
-- Pre-gate format validation of contractor labour UANs; an optional GSP confirms live.

DO $$ BEGIN CREATE TYPE "UanStatus" AS ENUM ('PENDING','VALID','INVALID'); EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "LabourUan" (
  "id" TEXT NOT NULL, "vendorId" TEXT, "workerName" TEXT NOT NULL, "uan" TEXT NOT NULL,
  "status" "UanStatus" NOT NULL DEFAULT 'PENDING', "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "LabourUan_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "LabourUan_uan_key" ON "LabourUan"("uan");
CREATE INDEX IF NOT EXISTS "LabourUan_vendorId_idx" ON "LabourUan"("vendorId");
CREATE INDEX IF NOT EXISTS "LabourUan_status_idx" ON "LabourUan"("status");

DO $$ BEGIN
  ALTER TABLE "LabourUan" ADD CONSTRAINT "LabourUan_vendorId_fkey"
    FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
