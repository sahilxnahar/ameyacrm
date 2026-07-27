-- Ameya Heights CRM — migration for v15.19 (shared inbox: two-way WhatsApp)
-- Idempotent: safe to run more than once. Run in Neon before deploying v15.19.
--
-- Adds a direction to WhatsApp messages so a staff reply sent from the shared
-- inbox can be stored and shown in the conversation alongside inbound messages.
-- The "MailDirection" enum already exists (added with the email inbox), so this
-- only adds one column.

DO $$ BEGIN
  CREATE TYPE "MailDirection" AS ENUM ('INBOUND', 'OUTBOUND');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "WhatsappMessage" ADD COLUMN IF NOT EXISTS "direction" "MailDirection" NOT NULL DEFAULT 'INBOUND';
