-- Ameya OS v16.12
-- Three columns on the supplier bill: the supplier's own paperwork, and what the
-- bill is for. Additive only; safe to run twice.
DO $$
BEGIN
  IF to_regclass('"VendorBill"') IS NULL THEN
    RAISE NOTICE 'VendorBill not present — skipping.';
  ELSE
    ALTER TABLE "VendorBill" ADD COLUMN IF NOT EXISTS "attachmentUrl"  TEXT;
    ALTER TABLE "VendorBill" ADD COLUMN IF NOT EXISTS "attachmentName" TEXT;
    ALTER TABLE "VendorBill" ADD COLUMN IF NOT EXISTS "notes"          TEXT;
  END IF;
END $$;
