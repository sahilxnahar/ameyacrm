-- ============================================================================
-- Ameya CRM — migration to v15.98
--
-- Safe to run more than once. Run on the DIRECT (unpooled) connection,
-- and take a backup first.
--
--   1. Statutory audit trail (edit log) for Ameya Tally
--
-- If you have NOT yet applied MIGRATION_v15.97_all.sql, run that one first —
-- this file only adds what is new in v15.98.
-- ============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- Edit log for the books.
--
-- Rule 3(1) of the Companies (Accounts) Rules requires accounting software to
-- keep an audit trail of every change, with its date, that cannot be switched
-- off; the auditor reports on it under Rule 11(g). This table is append-only —
-- nothing in the application updates or deletes a row in it.
--
-- `voucherNo`, `voucherType` and `voucherDate` are stored inline rather than
-- joined, so the trail still reads correctly after the voucher itself is gone.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "TallyVoucherAudit" (
  "id"          TEXT PRIMARY KEY,
  "companyId"   TEXT NOT NULL,
  "voucherId"   TEXT NOT NULL,
  "action"      TEXT NOT NULL,               -- CREATE | UPDATE | DELETE
  "voucherNo"   INTEGER NOT NULL,
  "voucherType" TEXT NOT NULL,
  "voucherDate" TIMESTAMP(3) NOT NULL,
  "before"      JSONB,                       -- null on CREATE
  "after"       JSONB,                       -- null on DELETE
  "summary"     TEXT NOT NULL,
  "actorId"     TEXT,
  "actorName"   TEXT NOT NULL,
  "at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "TallyVoucherAudit_companyId_at_idx" ON "TallyVoucherAudit"("companyId", "at");
CREATE INDEX IF NOT EXISTS "TallyVoucherAudit_voucherId_idx"    ON "TallyVoucherAudit"("voucherId");

COMMIT;

-- ── After running, confirm with: ─────────────────────────────────────────────
--   SELECT count(*) FROM "TallyVoucherAudit";
-- Then create a test voucher in Ameya Tally, edit it, and open
-- Gateway → Audit → Edit Log. Both events should be listed, with the before and
-- after amounts. Delete the test voucher — the trail must remain.
