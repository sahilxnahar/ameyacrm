-- Ameya Heights CRM v5.8 — self-signup with domain rules + admin approval
ALTER TYPE "UserStatus" ADD VALUE IF NOT EXISTS 'PENDING';

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "verifyToken"     TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "verifyExpiresAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "signupNote"      TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "approvedAt"      TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "approvedById"    TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "User_verifyToken_key" ON "User"("verifyToken");
