-- ============================================================================
-- Ameya Heights CRM — Migration v14.63
-- Adds an expense CATEGORY to vendor payments and back-fills your existing data.
--
-- Safe to run more than once (idempotent). Run it against your Neon database
-- (SQL editor) once, after deploying v14.63.
-- ============================================================================

-- 1) The new column: an expense category, stored as a chart-of-accounts code.
ALTER TABLE "Voucher" ADD COLUMN IF NOT EXISTS "accountCode" TEXT;

-- 2) Back-fill existing payments by keyword. Each statement only fills rows that
--    are still uncategorised, so running earlier statements first sets priority
--    and re-running the whole file never overwrites a category you have changed.

-- 5200 — Approvals & statutory fees (BBMP, BESCOM, sanction, khata, RERA…)
UPDATE "Voucher" SET "accountCode" = '5200'
WHERE "accountCode" IS NULL AND "kind" IN ('CASH_PAID','BANK_PAID')
  AND lower(coalesce("partyName",'') || ' ' || coalesce("narration",'')) ~
      '(bbmp|bescom|sanction|khata|katha|rera|plan approval|statutory|challan|eb connection|temp eb)';

-- 5300 — Materials (steel, cement, JSW, RMC…)
UPDATE "Voucher" SET "accountCode" = '5300'
WHERE "accountCode" IS NULL AND "kind" IN ('CASH_PAID','BANK_PAID')
  AND lower(coalesce("partyName",'') || ' ' || coalesce("narration",'')) ~
      '(steel|cement|sand|jsw|material|bricks|tmt|aggregate|rmc|concrete|tiles)';

-- 5400 — Labour & sub-contractors (Arun, construction, borewell, contractor…)
UPDATE "Voucher" SET "accountCode" = '5400'
WHERE "accountCode" IS NULL AND "kind" IN ('CASH_PAID','BANK_PAID')
  AND lower(coalesce("partyName",'') || ' ' || coalesce("narration",'')) ~
      '(arun|labour|labor|construction|contractor|borewell|solar|cctv|auctus|mason|trees|site work)';

-- 5500 — Professional fees (ROC, legal, GST, TM, soil test, Geofrontier…)
UPDATE "Voucher" SET "accountCode" = '5500'
WHERE "accountCode" IS NULL AND "kind" IN ('CASH_PAID','BANK_PAID')
  AND lower(coalesce("partyName",'') || ' ' || coalesce("narration",'')) ~
      '(roc|legal|gst|trademark|vineet|professional|consultant|audit|soil test|geofrontier|architect|advocate)';

-- 6000 — Overheads & admin: everything else that's a payment out.
UPDATE "Voucher" SET "accountCode" = '6000'
WHERE "accountCode" IS NULL AND "kind" IN ('CASH_PAID','BANK_PAID');
