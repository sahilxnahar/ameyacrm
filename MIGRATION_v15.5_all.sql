-- Ameya Heights CRM — migration for v15.5 (per-user Ameya Tally preferences)
-- Idempotent: safe to run more than once. Run in Neon before deploying v15.5.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tallyPrefs" JSONB;
