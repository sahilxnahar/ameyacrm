-- Ameya Heights CRM — migration for v15.67 (Module #6: Multilingual WhatsApp dunning)
-- Idempotent: safe to re-run. Run in Neon before deploying v15.67.
-- Adds a per-buyer preferred-language flag; demand reminders are sent in it
-- (en/hi/kn/ta reviewed templates, AI fallback for anything else, English on failure).

ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "preferredLang" TEXT;
