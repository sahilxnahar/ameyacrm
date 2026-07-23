-- Ameya Heights CRM — migration for v14.88 (Ameya Tally, phase 1)
-- Idempotent: safe to run more than once. Run in Neon before deploying v14.88.

CREATE TABLE IF NOT EXISTS "TallyLedger" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "openingBalance" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "openingSide" TEXT NOT NULL DEFAULT 'Dr',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TallyLedger_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "TallyLedger_name_key" ON "TallyLedger"("name");
CREATE INDEX IF NOT EXISTS "TallyLedger_group_idx" ON "TallyLedger"("group");

CREATE TABLE IF NOT EXISTS "TallyVoucher" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "narration" TEXT,
    "reference" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TallyVoucher_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "TallyVoucher_type_number_key" ON "TallyVoucher"("type", "number");
CREATE INDEX IF NOT EXISTS "TallyVoucher_date_idx" ON "TallyVoucher"("date");
CREATE INDEX IF NOT EXISTS "TallyVoucher_type_date_idx" ON "TallyVoucher"("type", "date");

CREATE TABLE IF NOT EXISTS "TallyVoucherLine" (
    "id" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "ledgerId" TEXT NOT NULL,
    "debit" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(16,2) NOT NULL DEFAULT 0,
    CONSTRAINT "TallyVoucherLine_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "TallyVoucherLine_voucherId_idx" ON "TallyVoucherLine"("voucherId");
CREATE INDEX IF NOT EXISTS "TallyVoucherLine_ledgerId_idx" ON "TallyVoucherLine"("ledgerId");

DO $$ BEGIN
  ALTER TABLE "TallyVoucherLine" ADD CONSTRAINT "TallyVoucherLine_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "TallyVoucher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "TallyVoucherLine" ADD CONSTRAINT "TallyVoucherLine_ledgerId_fkey" FOREIGN KEY ("ledgerId") REFERENCES "TallyLedger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
