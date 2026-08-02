-- ═══════════════════════════════════════════════════════════════════════════
--  Ameya OS — v16.5
--
--  Run this once against the production database before deploying v16.5.
--  Every statement is idempotent: running it twice is safe.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. A payment can now say which vendor bill it settles ───────────────────
--
-- Vendor bills post to the ledger from this release (cost and creditor on the
-- day the bill arrives, which is what accrual accounting means). A payment
-- against such a bill must CLEAR the creditor rather than book the expense a
-- second time, and this column is how the posting rule knows the difference.
ALTER TABLE "Voucher" ADD COLUMN IF NOT EXISTS "vendorBillId" TEXT;
CREATE INDEX IF NOT EXISTS "Voucher_vendorBillId_idx" ON "Voucher"("vendorBillId");

-- BOCW labour cess withheld from a contractor payment. Like TDS, it is money
-- you have kept back and still owe — to the welfare board — so it belongs in
-- the books as a liability rather than vanishing into a smaller project cost.
ALTER TABLE "Voucher" ADD COLUMN IF NOT EXISTS "cessAmount" DECIMAL(14,2);

-- ── 2. One entry per source document, enforced by the database ─────────────
--
-- `post({ once: true })` checks for an existing entry and then inserts. Two
-- concurrent callers — a double-clicked Approve, a cron and an admin replaying
-- the same webhook — can both pass the check and both insert, and the result is
-- a trial balance that still balances and is doubled. Only the database can
-- settle that race.
--
-- Partial, because reversed entries deliberately keep their source, and manual
-- entries have none.
CREATE UNIQUE INDEX IF NOT EXISTS "JournalEntry_source_once_idx"
  ON "JournalEntry"("sourceType", "sourceId")
  WHERE "sourceId" IS NOT NULL AND "status" <> 'REVERSED';

-- If the index above fails, this database already contains duplicate postings
-- from before v16.5. Find them with:
--
--   SELECT "sourceType", "sourceId", count(*), array_agg("number")
--   FROM "JournalEntry"
--   WHERE "sourceId" IS NOT NULL AND "status" <> 'REVERSED'
--   GROUP BY 1, 2 HAVING count(*) > 1;
--
-- Reverse the surplus entry from the ledger screen (never DELETE it), then run
-- this file again.

-- ── 3. Seed the voucher counters from the numbers already in use ────────────
--
-- Six places create vouchers and they used to allocate numbers two different
-- ways: an atomic counter, and MAX(number) read as text. They now share one
-- allocator. Seeding it here from the real maximum means the first payment
-- after the upgrade cannot collide with a number an import already used.
INSERT INTO "NumberSequence" ("key", "value", "updatedAt")
SELECT
  'voucher:' || p.prefix,
  GREATEST(1000, COALESCE(MAX(substring(v."number" from '[0-9]+$')::bigint), 1000)),
  NOW()
FROM (VALUES ('CR'), ('CP'), ('MR'), ('MI')) AS p(prefix)
LEFT JOIN "Voucher" v
  ON v."number" LIKE p.prefix || '-%'
 AND v."number" ~ ('^' || p.prefix || '-[0-9]+$')
GROUP BY p.prefix
ON CONFLICT ("key") DO UPDATE
  SET "value" = GREATEST("NumberSequence"."value", EXCLUDED."value"),
      "updatedAt" = NOW();

-- Same for the invoice series, which used count()+1 and therefore reissued a
-- number every time an invoice was deleted.
INSERT INTO "NumberSequence" ("key", "value", "updatedAt")
SELECT 'invoice:INV', GREATEST(0, COALESCE(MAX(substring("number" from '[0-9]+$')::bigint), 0)), NOW()
FROM "Invoice"
WHERE "number" ~ '^INV-[0-9]+$'
ON CONFLICT ("key") DO UPDATE
  SET "value" = GREATEST("NumberSequence"."value", EXCLUDED."value"),
      "updatedAt" = NOW();

-- ── 4. Seed the RA-bill counter too ────────────────────────────────────────
--
-- RA bills were numbered by MAX(number) read as text, so RA-9999 sorted above
-- RA-10000 and the series jammed at five digits. They now share the same atomic
-- counter the vouchers use.
INSERT INTO "NumberSequence" ("key", "value", "updatedAt")
SELECT 'rabill:RA', GREATEST(1000, COALESCE(MAX(substring("number" from '[0-9]+$')::bigint), 1000)), NOW()
FROM "RaBill"
WHERE "number" ~ '^RA-[0-9]+$'
ON CONFLICT ("key") DO UPDATE
  SET "value" = GREATEST("NumberSequence"."value", EXCLUDED."value"),
      "updatedAt" = NOW();
