-- ============================================================================
-- Ameya CRM — migration to v16.4
--
-- Safe to run more than once. DIRECT (unpooled) connection. Back up first.
--
--   1. Automatic payment reminders to parties who owe you money
--   2. MSME registration on the vendor, so the 45-day clock starts itself
--
-- Apply MIGRATION_v16.3_all.sql first if you have not (bill-wise tracking).
-- ============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Payment reminders.
--
-- This sends mail to people outside the company, so the defaults are the safe
-- ones: cadence OFF, and the whole feature additionally gated by a single
-- setting that starts switched off.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "TallyPartyReminder" (
  "id"              TEXT PRIMARY KEY,
  "companyId"       TEXT NOT NULL,
  "ledgerId"        TEXT NOT NULL,
  "email"           TEXT NOT NULL,
  "ccEmail"         TEXT,
  "cadence"         TEXT NOT NULL DEFAULT 'OFF',   -- OFF | WEEKLY | FORTNIGHTLY | MONTHLY
  "onlyWhenOverdue" BOOLEAN NOT NULL DEFAULT true,
  "pausedUntil"     TIMESTAMP(3),
  "lastSentAt"      TIMESTAMP(3),
  "sentCount"       INTEGER NOT NULL DEFAULT 0,
  "note"            TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "TallyPartyReminder_ledgerId_key"      ON "TallyPartyReminder"("ledgerId");
CREATE INDEX        IF NOT EXISTS "TallyPartyReminder_companyId_cadence_idx" ON "TallyPartyReminder"("companyId", "cadence");

CREATE TABLE IF NOT EXISTS "TallyPartyReminderSend" (
  "id"         TEXT PRIMARY KEY,
  "reminderId" TEXT NOT NULL,
  "sentAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "toEmail"    TEXT NOT NULL,
  "amount"     DECIMAL(14,2) NOT NULL,
  "billCount"  INTEGER NOT NULL,
  "ok"         BOOLEAN NOT NULL DEFAULT true,
  "error"      TEXT
);
CREATE INDEX IF NOT EXISTS "TallyPartyReminderSend_reminderId_sentAt_idx" ON "TallyPartyReminderSend"("reminderId", "sentAt");

DO $$ BEGIN
  ALTER TABLE "TallyPartyReminder" ADD CONSTRAINT "TallyPartyReminder_ledgerId_fkey"
    FOREIGN KEY ("ledgerId") REFERENCES "TallyLedger"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "TallyPartyReminderSend" ADD CONSTRAINT "TallyPartyReminderSend_reminderId_fkey"
    FOREIGN KEY ("reminderId") REFERENCES "TallyPartyReminder"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Explicitly off. Reminders send only once this is switched on in the app.
INSERT INTO "Setting" ("key", "value")
VALUES ('collections.remindersEnabled', 'false')
ON CONFLICT ("key") DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. MSME registration on the vendor.
--
-- s.15 MSMED Act sets the payment window (45 days with a written agreement,
-- 15 without); s.43B(h) of the Income-tax Act disallows the expense if you
-- miss it. Holding the flag on the vendor lets the clock start itself from
-- each bill, instead of somebody retyping the bill into the tracker.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "isMsme"           BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "udyamNumber"      TEXT;
ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "msmeHasAgreement" BOOLEAN NOT NULL DEFAULT true;

COMMIT;

-- ── After running ────────────────────────────────────────────────────────────
-- Reminders stay dormant until BOTH of these are true:
--   1. EMAIL_PROVIDER is set to something other than 'console' (otherwise mail
--      is only written to the server log and nobody receives anything), and
--   2. the master switch is turned on in the app.
-- Mark your MSME vendors with:  UPDATE "Vendor" SET "isMsme" = true WHERE ...
