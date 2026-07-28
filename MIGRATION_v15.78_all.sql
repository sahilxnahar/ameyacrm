-- v15.78 — Per-user outbound email (send AS the signed-in user).
-- Fixes: outbound mail always left as the shared hi@/no-reply sender even after a
-- user saved their personal IMAP app password. Sending now reuses that same
-- credential over SMTP and sends from the user's own address.
--
-- Fully additive. Safe to run more than once (IF NOT EXISTS guards).

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "smtpHost"   TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "smtpPort"   INTEGER;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "smtpSecure" BOOLEAN;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "sendAsSelf" BOOLEAN NOT NULL DEFAULT true;
