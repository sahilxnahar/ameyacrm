-- Ameya Heights CRM v7.0 — forecasting, incentives, maps, workflows,
-- e-signature, DPDP and error monitoring. Safe to re-run.

-- ── enums ───────────────────────────────────────────────────────────────────
DO $$ BEGIN CREATE TYPE "TargetMetric"      AS ENUM ('BOOKING_VALUE','BOOKINGS','LEADS','SITE_VISITS'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "IncentiveStatus"   AS ENUM ('ACCRUED','APPROVED','PAID');                      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "SignatureStatus"   AS ENUM ('PENDING','VIEWED','SIGNED','DECLINED','EXPIRED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "DataRequestType"   AS ENUM ('EXPORT','DELETE','CORRECTION');                   EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "DataRequestStatus" AS ENUM ('RECEIVED','IN_PROGRESS','COMPLETED','REJECTED');  EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── new columns on existing tables ──────────────────────────────────────────
ALTER TABLE "Lead"           ADD COLUMN IF NOT EXISTS "locality"      TEXT;
ALTER TABLE "Lead"           ADD COLUMN IF NOT EXISTS "latitude"      DOUBLE PRECISION;
ALTER TABLE "Lead"           ADD COLUMN IF NOT EXISTS "longitude"     DOUBLE PRECISION;
ALTER TABLE "Lead"           ADD COLUMN IF NOT EXISTS "consentAt"     TIMESTAMP(3);
ALTER TABLE "Lead"           ADD COLUMN IF NOT EXISTS "consentSource" TEXT;
ALTER TABLE "Project"        ADD COLUMN IF NOT EXISTS "latitude"      DOUBLE PRECISION;
ALTER TABLE "Project"        ADD COLUMN IF NOT EXISTS "longitude"     DOUBLE PRECISION;
ALTER TABLE "AutomationRule" ADD COLUMN IF NOT EXISTS "matchAll"      BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "AutomationRule" ADD COLUMN IF NOT EXISTS "elseActions"   JSONB;
ALTER TABLE "AutomationRule" ADD COLUMN IF NOT EXISTS "slaMinutes"    INTEGER;
ALTER TABLE "AutomationRule" ADD COLUMN IF NOT EXISTS "escalateToId"  TEXT;
ALTER TABLE "SocialActivity" ADD COLUMN IF NOT EXISTS "summary"       TEXT;
ALTER TABLE "SocialActivity" ADD COLUMN IF NOT EXISTS "notifiedAt"    TIMESTAMP(3);

-- ── new tables ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "SalesTarget" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL, "periodEnd" TIMESTAMP(3) NOT NULL,
  "metric" "TargetMetric" NOT NULL DEFAULT 'BOOKING_VALUE',
  "target" DECIMAL(14,2) NOT NULL, "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SalesTarget_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SalesTarget_userId_periodStart_metric_key" ON "SalesTarget"("userId","periodStart","metric");
CREATE INDEX IF NOT EXISTS "SalesTarget_periodStart_idx" ON "SalesTarget"("periodStart");

CREATE TABLE IF NOT EXISTS "IncentiveSlab" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL,
  "fromValue" DECIMAL(14,2) NOT NULL DEFAULT 0, "toValue" DECIMAL(14,2),
  "ratePercent" DECIMAL(6,3) NOT NULL DEFAULT 0, "flatAmount" DECIMAL(14,2),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IncentiveSlab_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "IncentiveEntry" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "bookingId" TEXT,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "baseValue" DECIMAL(14,2) NOT NULL, "amount" DECIMAL(14,2) NOT NULL,
  "slabName" TEXT, "status" "IncentiveStatus" NOT NULL DEFAULT 'ACCRUED',
  "note" TEXT, "approvedAt" TIMESTAMP(3), "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IncentiveEntry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "IncentiveEntry_userId_periodStart_idx" ON "IncentiveEntry"("userId","periodStart");
CREATE INDEX IF NOT EXISTS "IncentiveEntry_status_idx" ON "IncentiveEntry"("status");

CREATE TABLE IF NOT EXISTS "SignatureRequest" (
  "id" TEXT NOT NULL, "reference" TEXT NOT NULL, "title" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL, "signedFileUrl" TEXT,
  "entityType" TEXT, "entityId" TEXT,
  "requestedById" TEXT, "requestedByName" TEXT,
  "signerName" TEXT NOT NULL, "signerEmail" TEXT, "signerPhone" TEXT,
  "token" TEXT NOT NULL, "status" "SignatureStatus" NOT NULL DEFAULT 'PENDING',
  "message" TEXT, "viewedAt" TIMESTAMP(3), "signedAt" TIMESTAMP(3),
  "declineReason" TEXT, "signatureData" TEXT, "signerIp" TEXT, "signerUserAgent" TEXT,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SignatureRequest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SignatureRequest_reference_key" ON "SignatureRequest"("reference");
CREATE UNIQUE INDEX IF NOT EXISTS "SignatureRequest_token_key"     ON "SignatureRequest"("token");
CREATE INDEX IF NOT EXISTS "SignatureRequest_status_idx"           ON "SignatureRequest"("status");

CREATE TABLE IF NOT EXISTS "DataRequest" (
  "id" TEXT NOT NULL, "reference" TEXT NOT NULL,
  "type" "DataRequestType" NOT NULL,
  "status" "DataRequestStatus" NOT NULL DEFAULT 'RECEIVED',
  "subjectName" TEXT NOT NULL, "subjectEmail" TEXT NOT NULL, "subjectPhone" TEXT,
  "details" TEXT, "handledById" TEXT, "handledAt" TIMESTAMP(3),
  "resultUrl" TEXT, "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DataRequest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "DataRequest_reference_key" ON "DataRequest"("reference");
CREATE INDEX IF NOT EXISTS "DataRequest_status_idx"           ON "DataRequest"("status");

CREATE TABLE IF NOT EXISTS "ErrorLog" (
  "id" TEXT NOT NULL, "fingerprint" TEXT NOT NULL,
  "level" TEXT NOT NULL DEFAULT 'error',
  "message" TEXT NOT NULL, "stack" TEXT, "path" TEXT, "userId" TEXT,
  "count" INTEGER NOT NULL DEFAULT 1,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3), "notifiedAt" TIMESTAMP(3),
  CONSTRAINT "ErrorLog_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ErrorLog_fingerprint_key" ON "ErrorLog"("fingerprint");
CREATE INDEX IF NOT EXISTS "ErrorLog_lastSeenAt_idx"         ON "ErrorLog"("lastSeenAt");
CREATE INDEX IF NOT EXISTS "ErrorLog_resolvedAt_idx"         ON "ErrorLog"("resolvedAt");

-- ── foreign keys ────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='SalesTarget_userId_fkey') THEN
    ALTER TABLE "SalesTarget" ADD CONSTRAINT "SalesTarget_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='IncentiveEntry_userId_fkey') THEN
    ALTER TABLE "IncentiveEntry" ADD CONSTRAINT "IncentiveEntry_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
-- Ameya Heights CRM v7.1 — per-person social accounts + personal WhatsApp
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "whatsappNumber" TEXT;

CREATE TABLE IF NOT EXISTS "UserSocialAccount" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "channel" "SocialChannel" NOT NULL,
  "handle" TEXT NOT NULL,
  "profileUrl" TEXT,
  "displayName" TEXT,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "lastSyncAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserSocialAccount_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "UserSocialAccount_userId_channel_handle_key" ON "UserSocialAccount"("userId","channel","handle");
CREATE INDEX IF NOT EXISTS "UserSocialAccount_channel_idx" ON "UserSocialAccount"("channel");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='UserSocialAccount_userId_fkey') THEN
    ALTER TABLE "UserSocialAccount" ADD CONSTRAINT "UserSocialAccount_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
