-- ============================================================================
-- Ameya Heights CRM — Migration v14.72
-- Adds the Secret Cash Book (a private, OTP-locked cash book).
-- Safe to run more than once. Run once on Neon after deploying v14.72.
-- ============================================================================

CREATE TABLE IF NOT EXISTS "SecretCashEntry" (
  "id"          TEXT NOT NULL,
  "entryDate"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "direction"   TEXT NOT NULL DEFAULT 'OUT',
  "amount"      DECIMAL(14,2) NOT NULL,
  "party"       TEXT NOT NULL,
  "mode"        TEXT NOT NULL DEFAULT 'Cash',
  "reference"   TEXT,
  "note"        TEXT,
  "createdById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SecretCashEntry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SecretCashEntry_entryDate_idx" ON "SecretCashEntry"("entryDate");
