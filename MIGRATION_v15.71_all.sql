-- Ameya Heights CRM — migration for v15.71 (Per-user IMAP email integration)
-- Idempotent: safe to re-run. Run in Neon before deploying v15.71.
-- Each user can connect their own inbox; the password is encrypted at rest.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "imapHost" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "imapPort" INTEGER;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "imapUser" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "imapPassEnc" TEXT;
