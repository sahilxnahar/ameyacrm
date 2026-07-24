-- Ameya Heights CRM v9.2 — login hardening. Safe to re-run.

ALTER TABLE "TrustedDevice" ADD COLUMN IF NOT EXISTS "label"      TEXT;
ALTER TABLE "TrustedDevice" ADD COLUMN IF NOT EXISTS "ipAddress"  TEXT;
ALTER TABLE "TrustedDevice" ADD COLUMN IF NOT EXISTS "country"    TEXT;
ALTER TABLE "TrustedDevice" ADD COLUMN IF NOT EXISTS "userAgent"  TEXT;
ALTER TABLE "TrustedDevice" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "TrustedDevice" ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "TrustedDevice" ADD COLUMN IF NOT EXISTS "revokedAt"  TIMESTAMP(3);

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "twoFactorGraceUntil" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "allowForeignAccess"  BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastCountry"         TEXT;

ALTER TABLE "LoginHistory" ADD COLUMN IF NOT EXISTS "country" TEXT;

CREATE TABLE IF NOT EXISTS "DeviceApproval" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "deviceHash" TEXT NOT NULL,
  "ipAddress" TEXT, "country" TEXT, "userAgent" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeviceApproval_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "DeviceApproval_token_key"        ON "DeviceApproval"("token");
CREATE INDEX IF NOT EXISTS "DeviceApproval_userId_createdAt_idx"    ON "DeviceApproval"("userId","createdAt");
CREATE INDEX IF NOT EXISTS "DeviceApproval_expiresAt_idx"           ON "DeviceApproval"("expiresAt");
