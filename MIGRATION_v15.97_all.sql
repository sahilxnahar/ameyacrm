-- ============================================================================
-- Ameya CRM — migration to v15.97
--
-- Safe to run more than once: every statement is guarded.
-- Run on the DIRECT (unpooled) connection, and take a backup first.
--
-- Contents
--   1. Multi-company Ameya Tally  (from v15.93 — included so one file does it all)
--   2. Stock, inventory and cost centres
--   3. Atomic document-number counters   ← fixes numbering jamming at 10,000
--   4. Personal top-navigation layout
--   5. Guest sandbox tables
-- ============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Multi-company Tally
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "TallyCompany" (
  "id"        TEXT PRIMARY KEY,
  "name"      TEXT NOT NULL,
  "guid"      TEXT,
  "gstin"     TEXT,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "TallyCompany_name_key" ON "TallyCompany"("name");

-- The default company: everything created inside Ameya itself belongs here.
INSERT INTO "TallyCompany" ("id", "name", "isDefault", "createdAt", "updatedAt")
SELECT 'tallyco_default_0000000001', 'Ameya Heights', true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "TallyCompany" WHERE "isDefault" = true);

-- Add companyId to the Tally tables, then backfill existing books into the
-- default company BEFORE making the column mandatory.
ALTER TABLE "TallyLedger"  ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "TallyVoucher" ADD COLUMN IF NOT EXISTS "companyId" TEXT;

UPDATE "TallyLedger"  SET "companyId" = (SELECT id FROM "TallyCompany" WHERE "isDefault" LIMIT 1) WHERE "companyId" IS NULL;
UPDATE "TallyVoucher" SET "companyId" = (SELECT id FROM "TallyCompany" WHERE "isDefault" LIMIT 1) WHERE "companyId" IS NULL;

ALTER TABLE "TallyLedger"  ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "TallyVoucher" ALTER COLUMN "companyId" SET NOT NULL;

-- Swap the old global-uniqueness rules for per-company ones. Without this, a
-- second imported company collides on nearly every ledger name and voucher
-- number — every Tally company has a "Cash" ledger and a "Payment #1".
DROP INDEX IF EXISTS "TallyLedger_name_key";
DROP INDEX IF EXISTS "TallyVoucher_type_number_key";
CREATE UNIQUE INDEX IF NOT EXISTS "TallyLedger_companyId_name_key"          ON "TallyLedger"("companyId", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "TallyVoucher_companyId_type_number_key"  ON "TallyVoucher"("companyId", "type", "number");
CREATE INDEX        IF NOT EXISTS "TallyLedger_companyId_idx"               ON "TallyLedger"("companyId");
CREATE INDEX        IF NOT EXISTS "TallyVoucher_companyId_date_idx"         ON "TallyVoucher"("companyId", "date");

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Stock, inventory and cost centres
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "TallyStockItem" (
  "id"          TEXT PRIMARY KEY,
  "companyId"   TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "unit"        TEXT NOT NULL DEFAULT 'Nos',
  "hsn"         TEXT,
  "gstRate"     DECIMAL(5,2) NOT NULL DEFAULT 0,
  "openingQty"  DECIMAL(14,3) NOT NULL DEFAULT 0,
  "openingRate" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "TallyStockItem_companyId_name_key" ON "TallyStockItem"("companyId", "name");

CREATE TABLE IF NOT EXISTS "TallyCostCentre" (
  "id"        TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "TallyCostCentre_companyId_name_key" ON "TallyCostCentre"("companyId", "name");

CREATE TABLE IF NOT EXISTS "TallyInventoryLine" (
  "id"        TEXT PRIMARY KEY,
  "voucherId" TEXT NOT NULL,
  "itemId"    TEXT NOT NULL,
  "qty"       DECIMAL(14,3) NOT NULL DEFAULT 0,
  "rate"      DECIMAL(14,2) NOT NULL DEFAULT 0,
  "amount"    DECIMAL(14,2) NOT NULL DEFAULT 0,
  "direction" TEXT NOT NULL DEFAULT 'IN'
);
CREATE INDEX IF NOT EXISTS "TallyInventoryLine_voucherId_idx" ON "TallyInventoryLine"("voucherId");
CREATE INDEX IF NOT EXISTS "TallyInventoryLine_itemId_idx"    ON "TallyInventoryLine"("itemId");

ALTER TABLE "TallyVoucher" ADD COLUMN IF NOT EXISTS "costCentre"    TEXT;
ALTER TABLE "TallyVoucher" ADD COLUMN IF NOT EXISTS "importBatchId" TEXT;

CREATE TABLE IF NOT EXISTS "TallyImportBatch" (
  "id"              TEXT PRIMARY KEY,
  "companyId"       TEXT NOT NULL,
  "source"          TEXT NOT NULL DEFAULT 'XML',
  "fileName"        TEXT,
  "status"          TEXT NOT NULL DEFAULT 'PREVIEW',
  "fromDate"        TIMESTAMP(3),
  "toDate"          TIMESTAMP(3),
  "ledgersCreated"  INTEGER NOT NULL DEFAULT 0,
  "vouchersCreated" INTEGER NOT NULL DEFAULT 0,
  "vouchersSkipped" INTEGER NOT NULL DEFAULT 0,
  "linesCreated"    INTEGER NOT NULL DEFAULT 0,
  "warnings"        JSONB,
  "createdById"     TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "TallyImportBatch_companyId_idx" ON "TallyImportBatch"("companyId");

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Atomic document-number counters
--
-- Replaces "read the highest number and add one", which ordered numbers as TEXT
-- (so CR-9999 outranked CR-10000 and the series jammed permanently at five
-- digits) and raced between two people saving at the same moment.
--
-- The counters are seeded from the highest number already in use, so numbering
-- continues from where it is rather than restarting.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "NumberSequence" (
  "key"       TEXT PRIMARY KEY,
  "value"     INTEGER NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Voucher series (CR-, CP-, …), taken from the numeric part of existing numbers.
INSERT INTO "NumberSequence" ("key", "value", "updatedAt")
SELECT 'voucher:' || split_part("number", '-', 1),
       MAX(NULLIF(regexp_replace(split_part("number", '-', 2), '\D', '', 'g'), '')::INTEGER),
       NOW()
FROM "Voucher"
WHERE "number" LIKE '%-%'
GROUP BY split_part("number", '-', 1)
HAVING MAX(NULLIF(regexp_replace(split_part("number", '-', 2), '\D', '', 'g'), '')::INTEGER) IS NOT NULL
ON CONFLICT ("key") DO UPDATE
  SET "value" = GREATEST("NumberSequence"."value", EXCLUDED."value");

-- Journal entries (JV-000123).
INSERT INTO "NumberSequence" ("key", "value", "updatedAt")
SELECT 'journal:JV',
       MAX(NULLIF(regexp_replace(split_part("number", '-', 2), '\D', '', 'g'), '')::INTEGER),
       NOW()
FROM "JournalEntry"
WHERE "number" LIKE 'JV-%'
HAVING MAX(NULLIF(regexp_replace(split_part("number", '-', 2), '\D', '', 'g'), '')::INTEGER) IS NOT NULL
ON CONFLICT ("key") DO UPDATE
  SET "value" = GREATEST("NumberSequence"."value", EXCLUDED."value");

-- Demand notices (DL-1042).
INSERT INTO "NumberSequence" ("key", "value", "updatedAt")
SELECT 'demand:DL',
       MAX(NULLIF(regexp_replace(split_part("number", '-', 2), '\D', '', 'g'), '')::INTEGER),
       NOW()
FROM "DemandNotice"
WHERE "number" LIKE 'DL-%'
HAVING MAX(NULLIF(regexp_replace(split_part("number", '-', 2), '\D', '', 'g'), '')::INTEGER) IS NOT NULL
ON CONFLICT ("key") DO UPDATE
  SET "value" = GREATEST("NumberSequence"."value", EXCLUDED."value");

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Personal top-navigation layout
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "topNavPrefs" JSONB;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Guest sandbox
--
-- Separate tables, not a flag on the real ones: a guest's data has no path to
-- company data because the real tables are never queried for them.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "GuestSandbox" (
  "id"        TEXT PRIMARY KEY,
  "userId"    TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "seeded"    BOOLEAN NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX IF NOT EXISTS "GuestSandbox_userId_key"    ON "GuestSandbox"("userId");
CREATE INDEX        IF NOT EXISTS "GuestSandbox_expiresAt_idx" ON "GuestSandbox"("expiresAt");

CREATE TABLE IF NOT EXISTS "SandboxLead" (
  "id" TEXT PRIMARY KEY, "sandboxId" TEXT NOT NULL,
  "name" TEXT NOT NULL, "phone" TEXT, "email" TEXT,
  "source" TEXT NOT NULL DEFAULT 'Walk-in', "status" TEXT NOT NULL DEFAULT 'NEW',
  "budget" DECIMAL(14,2), "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "SandboxLead_sandboxId_idx" ON "SandboxLead"("sandboxId");

CREATE TABLE IF NOT EXISTS "SandboxUnit" (
  "id" TEXT PRIMARY KEY, "sandboxId" TEXT NOT NULL,
  "tower" TEXT NOT NULL, "number" TEXT NOT NULL, "typology" TEXT NOT NULL,
  "areaSqft" INTEGER NOT NULL, "price" DECIMAL(14,2) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "SandboxUnit_sandboxId_idx" ON "SandboxUnit"("sandboxId");

CREATE TABLE IF NOT EXISTS "SandboxTask" (
  "id" TEXT PRIMARY KEY, "sandboxId" TEXT NOT NULL,
  "title" TEXT NOT NULL, "done" BOOLEAN NOT NULL DEFAULT false, "dueDate" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "SandboxTask_sandboxId_idx" ON "SandboxTask"("sandboxId");

CREATE TABLE IF NOT EXISTS "SandboxLedgerEntry" (
  "id" TEXT PRIMARY KEY, "sandboxId" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL, "narration" TEXT NOT NULL,
  "debitAcc" TEXT NOT NULL, "creditAcc" TEXT NOT NULL, "amount" DECIMAL(14,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "SandboxLedgerEntry_sandboxId_idx" ON "SandboxLedgerEntry"("sandboxId");

CREATE TABLE IF NOT EXISTS "SandboxNote" (
  "id" TEXT PRIMARY KEY, "sandboxId" TEXT NOT NULL, "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "SandboxNote_sandboxId_idx" ON "SandboxNote"("sandboxId");

-- Foreign keys, added separately so re-running cannot fail on a duplicate name.
DO $$ BEGIN
  ALTER TABLE "GuestSandbox"       ADD CONSTRAINT "GuestSandbox_userId_fkey"          FOREIGN KEY ("userId")    REFERENCES "User"("id")         ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "SandboxLead"        ADD CONSTRAINT "SandboxLead_sandboxId_fkey"        FOREIGN KEY ("sandboxId") REFERENCES "GuestSandbox"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "SandboxUnit"        ADD CONSTRAINT "SandboxUnit_sandboxId_fkey"        FOREIGN KEY ("sandboxId") REFERENCES "GuestSandbox"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "SandboxTask"        ADD CONSTRAINT "SandboxTask_sandboxId_fkey"        FOREIGN KEY ("sandboxId") REFERENCES "GuestSandbox"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "SandboxLedgerEntry" ADD CONSTRAINT "SandboxLedgerEntry_sandboxId_fkey" FOREIGN KEY ("sandboxId") REFERENCES "GuestSandbox"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "SandboxNote"        ADD CONSTRAINT "SandboxNote_sandboxId_fkey"        FOREIGN KEY ("sandboxId") REFERENCES "GuestSandbox"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMIT;

-- ── After running, confirm with: ─────────────────────────────────────────────
--   SELECT key, value FROM "NumberSequence" ORDER BY key;
--   SELECT name, "isDefault" FROM "TallyCompany";
-- and run PORTING/scripts/verify-books.sql — sections 1-5 should be empty.
