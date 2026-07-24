-- Ameya Heights CRM — migration for v14.93 (Ameya Tally phase 6: cost centres / job costing)
-- Idempotent: safe to run more than once. Run in Neon before deploying v14.93.
-- (Run the earlier Tally migrations — v14.88, v14.89 — first if you haven't.)

ALTER TABLE "TallyVoucher" ADD COLUMN IF NOT EXISTS "costCentre" TEXT;
CREATE INDEX IF NOT EXISTS "TallyVoucher_costCentre_idx" ON "TallyVoucher"("costCentre");

CREATE TABLE IF NOT EXISTS "TallyCostCentre" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TallyCostCentre_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "TallyCostCentre_name_key" ON "TallyCostCentre"("name");
