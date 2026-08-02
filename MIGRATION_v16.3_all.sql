-- ============================================================================
-- Ameya CRM — migration to v16.3
--
-- Safe to run more than once. Run on the DIRECT (unpooled) connection,
-- and take a backup first.
--
--   1. Bill-wise tracking for Ameya Tally
--
-- Apply MIGRATION_v15.98_all.sql first if you have not already (it adds the
-- statutory edit log). This file only adds what is new.
-- ============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- Bills.
--
-- A party ledger balance of ₹42 lakh tells you nothing you can act on. "Invoice
-- AH/24-25/118, ₹12 lakh, 40 days past due" is what you ring somebody about.
--
-- The reference is unique per party per company, so the same invoice number
-- cannot be raised twice against one buyer and quietly double-count the debt.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "TallyBill" (
  "id"        TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "ledgerId"  TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "billDate"  TIMESTAMP(3) NOT NULL,
  "dueDate"   TIMESTAMP(3),
  "amount"    DECIMAL(14,2) NOT NULL,
  "kind"      TEXT NOT NULL,               -- RECEIVABLE | PAYABLE
  "narration" TEXT,
  "voucherId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "TallyBill_companyId_ledgerId_reference_key" ON "TallyBill"("companyId", "ledgerId", "reference");
CREATE INDEX IF NOT EXISTS "TallyBill_companyId_kind_idx" ON "TallyBill"("companyId", "kind");
CREATE INDEX IF NOT EXISTS "TallyBill_ledgerId_idx"       ON "TallyBill"("ledgerId");
CREATE INDEX IF NOT EXISTS "TallyBill_dueDate_idx"        ON "TallyBill"("dueDate");

-- ─────────────────────────────────────────────────────────────────────────────
-- Money set against a bill.
--
-- A join table, not a column: one receipt can be split across several bills,
-- and one bill can be settled by several receipts. That is the ordinary case in
-- construction, not an edge case.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "TallyBillAllocation" (
  "id"        TEXT PRIMARY KEY,
  "billId"    TEXT NOT NULL,
  "voucherId" TEXT NOT NULL,
  "amount"    DECIMAL(14,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "TallyBillAllocation_billId_idx"    ON "TallyBillAllocation"("billId");
CREATE INDEX IF NOT EXISTS "TallyBillAllocation_voucherId_idx" ON "TallyBillAllocation"("voucherId");

DO $$ BEGIN
  ALTER TABLE "TallyBill" ADD CONSTRAINT "TallyBill_ledgerId_fkey"
    FOREIGN KEY ("ledgerId") REFERENCES "TallyLedger"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "TallyBillAllocation" ADD CONSTRAINT "TallyBillAllocation_billId_fkey"
    FOREIGN KEY ("billId") REFERENCES "TallyBill"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "TallyBillAllocation" ADD CONSTRAINT "TallyBillAllocation_voucherId_fkey"
    FOREIGN KEY ("voucherId") REFERENCES "TallyVoucher"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMIT;

-- ── After running ────────────────────────────────────────────────────────────
-- Open Ameya Tally → Gateway → Bill-wise Outstanding. It will be empty until
-- you either record a bill by hand or raise a Sales/Purchase invoice, which now
-- creates one automatically.
--
--   SELECT count(*) FROM "TallyBill";
