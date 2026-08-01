-- v15.93 — Ameya Tally: multi-company books + Tally import.
--
-- WHY: a real Tally installation holds several companies, and every company
-- reuses the same master names ("Cash", "Sales") and restarts voucher numbering
-- at 1. The old schema made TallyLedger.name / TallyStockItem.name / TallyCostCentre.name
-- GLOBALLY unique and vouchers unique on (type, number), so importing a second
-- company would collide on almost every row. This migration scopes all Tally
-- data by company.
--
-- SAFE FOR EXISTING DATA: a default company is created and every existing row is
-- backfilled to it before the new constraints are applied, so nothing is lost and
-- the current books keep working exactly as before.
--
-- Idempotent — safe to run more than once. TAKE A DATABASE BACKUP FIRST.

-- ── 1. New tables ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "TallyCompany" (
    "id"        TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "guid"      TEXT,
    "booksFrom" TIMESTAMP(3),
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive"  BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TallyCompany_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "TallyCompany_name_key" ON "TallyCompany"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "TallyCompany_guid_key" ON "TallyCompany"("guid");

CREATE TABLE IF NOT EXISTS "TallyImportBatch" (
    "id"              TEXT NOT NULL,
    "companyId"       TEXT,
    "source"          TEXT NOT NULL,
    "fileName"        TEXT,
    "status"          TEXT NOT NULL DEFAULT 'PREVIEW',
    "ledgersCreated"  INTEGER NOT NULL DEFAULT 0,
    "ledgersUpdated"  INTEGER NOT NULL DEFAULT 0,
    "vouchersCreated" INTEGER NOT NULL DEFAULT 0,
    "vouchersSkipped" INTEGER NOT NULL DEFAULT 0,
    "linesCreated"    INTEGER NOT NULL DEFAULT 0,
    "fromDate"        TIMESTAMP(3),
    "toDate"          TIMESTAMP(3),
    "warnings"        JSONB,
    "error"           TEXT,
    "importedById"    TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TallyImportBatch_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "TallyImportBatch_companyId_createdAt_idx" ON "TallyImportBatch"("companyId", "createdAt");
CREATE INDEX IF NOT EXISTS "TallyImportBatch_status_idx" ON "TallyImportBatch"("status");

-- ── 2. Seed the default company (holds all pre-existing books) ──────────────
INSERT INTO "TallyCompany" ("id", "name", "isDefault", "createdAt", "updatedAt")
SELECT 'tallyco_default_0000000000', 'Ameya Heights', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "TallyCompany" WHERE "isDefault" = true);

-- ── 3. Add companyId columns (nullable first, so existing rows survive) ─────
ALTER TABLE "TallyLedger"     ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "TallyLedger"     ADD COLUMN IF NOT EXISTS "tallyGuid" TEXT;
ALTER TABLE "TallyVoucher"    ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "TallyVoucher"    ADD COLUMN IF NOT EXISTS "tallyGuid" TEXT;
ALTER TABLE "TallyVoucher"    ADD COLUMN IF NOT EXISTS "importBatchId" TEXT;
ALTER TABLE "TallyCostCentre" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "TallyStockItem"  ADD COLUMN IF NOT EXISTS "companyId" TEXT;

-- ── 4. Backfill every existing row to the default company ──────────────────
UPDATE "TallyLedger"     SET "companyId" = (SELECT "id" FROM "TallyCompany" WHERE "isDefault" = true LIMIT 1) WHERE "companyId" IS NULL;
UPDATE "TallyVoucher"    SET "companyId" = (SELECT "id" FROM "TallyCompany" WHERE "isDefault" = true LIMIT 1) WHERE "companyId" IS NULL;
UPDATE "TallyCostCentre" SET "companyId" = (SELECT "id" FROM "TallyCompany" WHERE "isDefault" = true LIMIT 1) WHERE "companyId" IS NULL;
UPDATE "TallyStockItem"  SET "companyId" = (SELECT "id" FROM "TallyCompany" WHERE "isDefault" = true LIMIT 1) WHERE "companyId" IS NULL;

-- ── 5. Now that every row has a company, make the column required ──────────
ALTER TABLE "TallyLedger"     ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "TallyVoucher"    ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "TallyCostCentre" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "TallyStockItem"  ALTER COLUMN "companyId" SET NOT NULL;

-- ── 6. Swap global uniques for company-scoped ones ─────────────────────────
DROP INDEX IF EXISTS "TallyLedger_name_key";
DROP INDEX IF EXISTS "TallyStockItem_name_key";
DROP INDEX IF EXISTS "TallyCostCentre_name_key";
DROP INDEX IF EXISTS "TallyVoucher_type_number_key";

CREATE UNIQUE INDEX IF NOT EXISTS "TallyLedger_companyId_name_key"        ON "TallyLedger"("companyId", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "TallyStockItem_companyId_name_key"     ON "TallyStockItem"("companyId", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "TallyCostCentre_companyId_name_key"    ON "TallyCostCentre"("companyId", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "TallyVoucher_companyId_type_number_key" ON "TallyVoucher"("companyId", "type", "number");
CREATE UNIQUE INDEX IF NOT EXISTS "TallyVoucher_companyId_tallyGuid_key"   ON "TallyVoucher"("companyId", "tallyGuid");

CREATE INDEX IF NOT EXISTS "TallyLedger_companyId_idx"     ON "TallyLedger"("companyId");
CREATE INDEX IF NOT EXISTS "TallyStockItem_companyId_idx"  ON "TallyStockItem"("companyId");
CREATE INDEX IF NOT EXISTS "TallyCostCentre_companyId_idx" ON "TallyCostCentre"("companyId");
CREATE INDEX IF NOT EXISTS "TallyVoucher_companyId_date_idx"    ON "TallyVoucher"("companyId", "date");
CREATE INDEX IF NOT EXISTS "TallyVoucher_importBatchId_idx"     ON "TallyVoucher"("importBatchId");

-- ── 7. Foreign keys ────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TallyLedger_companyId_fkey') THEN
    ALTER TABLE "TallyLedger" ADD CONSTRAINT "TallyLedger_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "TallyCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TallyVoucher_companyId_fkey') THEN
    ALTER TABLE "TallyVoucher" ADD CONSTRAINT "TallyVoucher_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "TallyCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TallyCostCentre_companyId_fkey') THEN
    ALTER TABLE "TallyCostCentre" ADD CONSTRAINT "TallyCostCentre_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "TallyCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TallyStockItem_companyId_fkey') THEN
    ALTER TABLE "TallyStockItem" ADD CONSTRAINT "TallyStockItem_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "TallyCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TallyImportBatch_companyId_fkey') THEN
    ALTER TABLE "TallyImportBatch" ADD CONSTRAINT "TallyImportBatch_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "TallyCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
