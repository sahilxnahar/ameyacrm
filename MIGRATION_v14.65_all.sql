-- ============================================================================
-- Ameya Heights CRM — Migration v14.65
-- Adds: advances & retention, TDS, and recurring payments.
-- Safe to run more than once (idempotent). Run once on Neon after deploying.
-- ============================================================================

-- Advances & retention, and TDS — new columns on each payment (voucher).
ALTER TABLE "Voucher" ADD COLUMN IF NOT EXISTS "isAdvance"         BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Voucher" ADD COLUMN IF NOT EXISTS "advanceSettled"    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Voucher" ADD COLUMN IF NOT EXISTS "retentionAmount"   DECIMAL(14,2);
ALTER TABLE "Voucher" ADD COLUMN IF NOT EXISTS "retentionReleased" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Voucher" ADD COLUMN IF NOT EXISTS "tdsAmount"         DECIMAL(14,2);
ALTER TABLE "Voucher" ADD COLUMN IF NOT EXISTS "tdsRate"           DECIMAL(5,2);

-- Recurring payments (salaries, rent, EMIs, subscriptions).
CREATE TABLE IF NOT EXISTS "RecurringPayment" (
  "id"          TEXT NOT NULL,
  "payeeName"   TEXT NOT NULL,
  "vendorId"    TEXT,
  "amount"      DECIMAL(14,2) NOT NULL,
  "frequency"   TEXT NOT NULL DEFAULT 'MONTHLY',
  "nextDue"     TIMESTAMP(3) NOT NULL,
  "accountCode" TEXT,
  "projectId"   TEXT,
  "mode"        TEXT,
  "note"        TEXT,
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "lastPaidAt"  TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecurringPayment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "RecurringPayment_isActive_nextDue_idx" ON "RecurringPayment"("isActive", "nextDue");
