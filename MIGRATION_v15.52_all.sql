-- Ameya Heights CRM — migration for v15.52 (TDS Management module)
-- Idempotent: safe to run more than once. Run in Neon before deploying v15.52.
--
-- Adds TDS section + deposit tracking to payment vouchers, and a default TDS
-- section on the vendor master. The TDS section rates themselves live in code
-- (src/config/tds-sections.ts) so statutory changes ship with a release, not a
-- data edit. No new tables — this builds on the existing Voucher.tdsAmount field.

ALTER TABLE "Vendor"  ADD COLUMN IF NOT EXISTS "defaultTdsSection" TEXT;

ALTER TABLE "Voucher" ADD COLUMN IF NOT EXISTS "tdsSection"     TEXT;
ALTER TABLE "Voucher" ADD COLUMN IF NOT EXISTS "tdsChallanNo"   TEXT;
ALTER TABLE "Voucher" ADD COLUMN IF NOT EXISTS "tdsDepositedAt" TIMESTAMP(3);

-- Speeds up the "pending vs deposited" dashboard and the per-account ledger.
CREATE INDEX IF NOT EXISTS "Voucher_tdsDepositedAt_idx" ON "Voucher"("tdsDepositedAt");
