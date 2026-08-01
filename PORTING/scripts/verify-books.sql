-- Data-integrity checks for the accounting side.
-- Every query here should return ZERO rows. Anything else needs investigating
-- before you trust a report built on it.

\echo '== 1. Journal entries where debits do not equal credits =='
SELECT "entryId", SUM(debit) AS total_debit, SUM(credit) AS total_credit
FROM "JournalLine"
GROUP BY "entryId"
HAVING SUM(debit) <> SUM(credit);

\echo '== 2. Tally vouchers that do not balance =='
SELECT v.id, v.type, v.number, SUM(l.debit) AS dr, SUM(l.credit) AS cr
FROM "TallyVoucher" v
JOIN "TallyVoucherLine" l ON l."voucherId" = v.id
GROUP BY v.id, v.type, v.number
HAVING SUM(l.debit) <> SUM(l.credit);

\echo '== 3. Duplicate voucher numbers within a company =='
SELECT "companyId", type, number, COUNT(*)
FROM "TallyVoucher"
GROUP BY "companyId", type, number
HAVING COUNT(*) > 1;

\echo '== 4. Cancelled vouchers whose ledger entry is still posted =='
\echo '   (these overstate the books — see cancelVoucher)'
SELECT v.number, v.amount, j.number AS journal_number
FROM "Voucher" v
JOIN "JournalEntry" j ON j."sourceType" = 'Voucher' AND j."sourceId" = v.id
WHERE v.status = 'CANCELLED' AND j.status = 'POSTED';

\echo '== 5. Flats with more than one live booking =='
SELECT "unitId", COUNT(*) AS bookings
FROM "Booking"
WHERE status IN ('CONFIRMED', 'AGREEMENT', 'REGISTERED') AND "unitId" IS NOT NULL
GROUP BY "unitId"
HAVING COUNT(*) > 1;

\echo '== 6. Document-number counters (informational, not an error) =='
SELECT key, value FROM "NumberSequence" ORDER BY key;

\echo 'Checks complete. Sections 1-5 should all be empty.'
