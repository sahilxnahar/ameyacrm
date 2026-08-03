-- ═══════════════════════════════════════════════════════════════════════════
--  Ameya OS — v16.5
--
--  Run this once against the production database before deploying v16.5.
--  Every statement is idempotent: running it twice is safe.
-- ═══════════════════════════════════════════════════════════════════════════

-- One transaction, all or nothing. v16.3 and v16.4 both did this; without it a
-- failure at step 2 leaves steps 1 and 3 applied and step 4 skipped, which is a
-- half-applied release that nobody can tell apart from a whole one.
--
-- The index builds below take a brief write lock on Voucher and JournalEntry.
-- At Ameya's scale (thousands of vouchers) that is sub-second. If these tables
-- ever run to millions of rows, split the two CREATE INDEX statements out of
-- this transaction and run them CONCURRENTLY instead — that cannot be done
-- inside a transaction, which is why it is a deliberate later step and not the
-- default here.
SET lock_timeout = '10s';

BEGIN;

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

-- An ad-hoc recovery withheld from a contractor payment — usually a
-- mobilisation advance being set off. It shrinks the cheque without shrinking
-- the cost, so it has to clear the advance rather than disappear: without it,
-- project cost was understated by the recovery AND the advance stayed on the
-- balance sheet as an asset that could never come off.
ALTER TABLE "Voucher" ADD COLUMN IF NOT EXISTS "deductionAmount" DECIMAL(14,2);

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
--
-- Invoice numbers are INV-<year>-<seq> (docNumber in lib/utils/reference.ts),
-- e.g. INV-2026-0157 — NOT INV-157. Seeding from the wrong shape matched
-- nothing, left the counter at 0, and handed the next invoice a number that
-- already existed: a unique-constraint failure on every invoice raised until
-- the counter caught up. The trailing group is the sequence.
INSERT INTO "NumberSequence" ("key", "value", "updatedAt")
SELECT 'invoice:INV', GREATEST(0, COALESCE(MAX(substring("number" from '([0-9]+)$')::bigint), 0)), NOW()
FROM "Invoice"
WHERE "number" ~ '^INV-[0-9]{4}-[0-9]+$'
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

-- ── 5. The other three series that were numbered by count()+1 ──────────────
--
-- Purchase orders, channel-partner codes and payment requests all counted rows
-- and added one. All three columns are UNIQUE, so deleting a single row made
-- the next insert collide, and two simultaneous ones always did. They now use
-- the same atomic counter as everything else; these seeds carry across what
-- has already been issued.
INSERT INTO "NumberSequence" ("key", "value", "updatedAt")
SELECT 'po:PO', GREATEST(0, COALESCE(MAX(substring("number" from '([0-9]+)$')::bigint), 0)), NOW()
FROM "PurchaseOrder" WHERE "number" ~ '^PO-[0-9]{4}-[0-9]+$'
ON CONFLICT ("key") DO UPDATE SET "value" = GREATEST("NumberSequence"."value", EXCLUDED."value"), "updatedAt" = NOW();

INSERT INTO "NumberSequence" ("key", "value", "updatedAt")
SELECT 'partner:CP', GREATEST(1000, COALESCE(MAX(substring("code" from '([0-9]+)$')::bigint), 1000)), NOW()
FROM "ChannelPartner" WHERE "code" ~ '^CP-[0-9]+$'
ON CONFLICT ("key") DO UPDATE SET "value" = GREATEST("NumberSequence"."value", EXCLUDED."value"), "updatedAt" = NOW();

INSERT INTO "NumberSequence" ("key", "value", "updatedAt")
SELECT 'payreq:PAY', GREATEST(1000, COALESCE(MAX(substring("reference" from '([0-9]+)$')::bigint), 1000)), NOW()
FROM "PaymentRequest" WHERE "reference" ~ '^PAY-[0-9]+$'
ON CONFLICT ("key") DO UPDATE SET "value" = GREATEST("NumberSequence"."value", EXCLUDED."value"), "updatedAt" = NOW();

-- ── 6. The chart of accounts gained one account ────────────────────────────
--
-- 2155 Labour cess payable (BOCW). The posting rule for a contractor payment
-- credits it, and `post()` refuses an entry naming an account that does not
-- exist — so without this row every contractor payment with cess withheld would
-- save and silently never reach the books. Seeding only runs on an empty chart,
-- which is why an existing install needs it here.
INSERT INTO "Account" ("id", "code", "name", "type", "side", "isGroup", "isSystem", "isActive", "openingBalance", "createdAt", "updatedAt")
SELECT 'acc-2155-bocw', '2155', 'Labour cess payable (BOCW)', 'LIABILITY', 'CREDIT', false, true, true, 0, NOW(), NOW()
WHERE EXISTS (SELECT 1 FROM "Account")            -- only where a chart already exists
  AND NOT EXISTS (SELECT 1 FROM "Account" WHERE "code" = '2155');

COMMIT;
