-- Ameya OS — MIGRATION_v16.14_all.sql
--
-- Everything the database needs for v16.6 through v16.14, in one file. It
-- replaces MIGRATION_v16.12_all.sql, which only carried three of these four
-- columns. Additive only: no column is dropped, no data is rewritten, and it is
-- safe to run twice or on a database that is already up to date.
--
--   psql "$DATABASE_URL" -f MIGRATION_v16.14_all.sql
--
-- The in-app Repair button (Admin → Settings) now does the same thing. It did
-- not before v16.14 — the generated schema it runs had never been rebuilt after
-- these columns were added, so Repair reported success and changed nothing. If
-- Billing or Payments Made has been showing an error, this is why.

DO $$
BEGIN

  -- v16.12 — a supplier bill can carry the supplier's own paperwork.
  -- attachmentUrl / attachmentName: the PDF or photograph the figure came from,
  -- so whoever approves the payment can see it instead of taking it on trust.
  -- notes: what the bill is actually for.
  IF to_regclass('"VendorBill"') IS NULL THEN
    RAISE NOTICE 'VendorBill not present — skipping (run /api/setup first).';
  ELSE
    ALTER TABLE "VendorBill" ADD COLUMN IF NOT EXISTS "attachmentUrl"  TEXT;
    ALTER TABLE "VendorBill" ADD COLUMN IF NOT EXISTS "attachmentName" TEXT;
    ALTER TABLE "VendorBill" ADD COLUMN IF NOT EXISTS "notes"          TEXT;
    RAISE NOTICE 'VendorBill: attachment and notes columns present.';
  END IF;

  -- The TDS or other statutory amount withheld on a payment voucher, held apart
  -- from the gross so the challan and the ledger agree.
  IF to_regclass('"Voucher"') IS NULL THEN
    RAISE NOTICE 'Voucher not present — skipping.';
  ELSE
    ALTER TABLE "Voucher" ADD COLUMN IF NOT EXISTS "deductionAmount" DECIMAL(14,2);
    RAISE NOTICE 'Voucher: deductionAmount present.';
  END IF;

END $$;

-- Confirm. Every row below should read 'yes'.
SELECT 'VendorBill.attachmentUrl'  AS column,
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                         WHERE table_name = 'VendorBill' AND column_name = 'attachmentUrl')
            THEN 'yes' ELSE 'NO — check the notices above' END AS present
UNION ALL SELECT 'VendorBill.attachmentName',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                         WHERE table_name = 'VendorBill' AND column_name = 'attachmentName')
            THEN 'yes' ELSE 'NO — check the notices above' END
UNION ALL SELECT 'VendorBill.notes',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                         WHERE table_name = 'VendorBill' AND column_name = 'notes')
            THEN 'yes' ELSE 'NO — check the notices above' END
UNION ALL SELECT 'Voucher.deductionAmount',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                         WHERE table_name = 'Voucher' AND column_name = 'deductionAmount')
            THEN 'yes' ELSE 'NO — check the notices above' END;
