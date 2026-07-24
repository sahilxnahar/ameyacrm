-- Ameya Heights CRM — migration for v15.12 (per-user automation preferences)
-- Idempotent: safe to run more than once. Run in Neon before deploying v15.12.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "automationPrefs" JSONB;
