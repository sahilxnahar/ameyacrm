-- Ameya Heights CRM v5.8 — self-signup with domain rules + admin approval
ALTER TYPE "UserStatus" ADD VALUE IF NOT EXISTS 'PENDING';

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "verifyToken"     TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "verifyExpiresAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "signupNote"      TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "approvedAt"      TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "approvedById"    TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "User_verifyToken_key" ON "User"("verifyToken");
-- Ameya Heights CRM v5.9 — department tree (divisions + teams)
ALTER TABLE "Department" ADD COLUMN IF NOT EXISTS "parentId" TEXT;
CREATE INDEX IF NOT EXISTS "Department_parentId_idx" ON "Department"("parentId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Department_parentId_fkey') THEN
    ALTER TABLE "Department"
      ADD CONSTRAINT "Department_parentId_fkey"
      FOREIGN KEY ("parentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
-- Ameya Heights CRM v6.0 — reporting hierarchy
-- The column exists in most databases already; these statements are safe to re-run.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "managerId" TEXT;
CREATE INDEX IF NOT EXISTS "User_managerId_idx" ON "User"("managerId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_managerId_fkey') THEN
    ALTER TABLE "User"
      ADD CONSTRAINT "User_managerId_fkey"
      FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
