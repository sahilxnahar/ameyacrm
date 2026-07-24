-- Ameya Heights CRM v9.0 — two-way email, sequences, SSO. Safe to re-run.

DO $$ BEGIN CREATE TYPE "MailDirection"    AS ENUM ('INBOUND','OUTBOUND');                       EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "SequenceStatus"   AS ENUM ('ACTIVE','PAUSED','ARCHIVED');               EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "EnrollmentStatus" AS ENUM ('RUNNING','REPLIED','FINISHED','STOPPED');   EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "MailThreadMessage" (
  "id" TEXT NOT NULL,
  "externalId" TEXT,
  "threadKey" TEXT NOT NULL,
  "direction" "MailDirection" NOT NULL,
  "fromAddress" TEXT NOT NULL,
  "toAddresses" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "subject" TEXT, "bodyText" TEXT, "snippet" TEXT,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leadId" TEXT, "customerId" TEXT, "userId" TEXT,
  "trackToken" TEXT, "openedAt" TIMESTAMP(3),
  "openCount" INTEGER NOT NULL DEFAULT 0,
  "enrollmentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MailThreadMessage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MailThreadMessage_externalId_key" ON "MailThreadMessage"("externalId");
CREATE UNIQUE INDEX IF NOT EXISTS "MailThreadMessage_trackToken_key" ON "MailThreadMessage"("trackToken");
CREATE INDEX IF NOT EXISTS "MailThreadMessage_leadId_sentAt_idx"     ON "MailThreadMessage"("leadId","sentAt");
CREATE INDEX IF NOT EXISTS "MailThreadMessage_customerId_sentAt_idx" ON "MailThreadMessage"("customerId","sentAt");
CREATE INDEX IF NOT EXISTS "MailThreadMessage_threadKey_idx"         ON "MailThreadMessage"("threadKey");

CREATE TABLE IF NOT EXISTS "EmailSequence" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "description" TEXT,
  "status" "SequenceStatus" NOT NULL DEFAULT 'PAUSED',
  "stopOnReply" BOOLEAN NOT NULL DEFAULT true,
  "stopOnStage" TEXT, "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailSequence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SequenceStep" (
  "id" TEXT NOT NULL, "sequenceId" TEXT NOT NULL,
  "ordinal" INTEGER NOT NULL DEFAULT 0,
  "dayOffset" INTEGER NOT NULL DEFAULT 0,
  "subject" TEXT NOT NULL, "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SequenceStep_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SequenceStep_sequenceId_ordinal_key" ON "SequenceStep"("sequenceId","ordinal");

CREATE TABLE IF NOT EXISTS "SequenceEnrollment" (
  "id" TEXT NOT NULL, "sequenceId" TEXT NOT NULL, "leadId" TEXT NOT NULL,
  "status" "EnrollmentStatus" NOT NULL DEFAULT 'RUNNING',
  "stepsSent" INTEGER NOT NULL DEFAULT 0,
  "nextStepAt" TIMESTAMP(3), "enrolledById" TEXT,
  "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3), "endReason" TEXT,
  CONSTRAINT "SequenceEnrollment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SequenceEnrollment_sequenceId_leadId_key" ON "SequenceEnrollment"("sequenceId","leadId");
CREATE INDEX IF NOT EXISTS "SequenceEnrollment_status_nextStepAt_idx" ON "SequenceEnrollment"("status","nextStepAt");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='SequenceStep_sequenceId_fkey') THEN
    ALTER TABLE "SequenceStep" ADD CONSTRAINT "SequenceStep_sequenceId_fkey"
      FOREIGN KEY ("sequenceId") REFERENCES "EmailSequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='SequenceEnrollment_sequenceId_fkey') THEN
    ALTER TABLE "SequenceEnrollment" ADD CONSTRAINT "SequenceEnrollment_sequenceId_fkey"
      FOREIGN KEY ("sequenceId") REFERENCES "EmailSequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
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
-- Ameya Heights CRM v9.3 — folder mirroring to Drive + background processing.
ALTER TABLE "Folder"     ADD COLUMN IF NOT EXISTS "driveFolderId" TEXT;
ALTER TABLE "FileObject" ADD COLUMN IF NOT EXISTS "syncState" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "FileObject" ADD COLUMN IF NOT EXISTS "syncError" TEXT;
CREATE INDEX IF NOT EXISTS "FileObject_syncState_idx" ON "FileObject"("syncState");
-- Ameya Heights CRM v9.4 — indexes for the queries the hot pages run.
-- Full-text index for the keyword pre-filter in document search.
-- Wrapped so an older Postgres without the extension cannot fail the migration.
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "DocChunk_content_fts_idx" ON "DocChunk" USING GIN (to_tsvector('english', "content"));
EXCEPTION WHEN others THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "Document_folderId_deletedAt_idx" ON "Document"("folderId","deletedAt");
CREATE INDEX IF NOT EXISTS "Folder_parentId_deletedAt_idx"   ON "Folder"("parentId","deletedAt");
CREATE INDEX IF NOT EXISTS "FolderPermission_folderId_idx"   ON "FolderPermission"("folderId");
CREATE INDEX IF NOT EXISTS "TaskAssignee_userId_idx"         ON "TaskAssignee"("userId");
CREATE INDEX IF NOT EXISTS "DocumentVersion_fileId_idx"      ON "DocumentVersion"("fileId");
CREATE INDEX IF NOT EXISTS "MailThreadMessage_leadId_idx"    ON "MailThreadMessage"("leadId");
-- Ameya Heights CRM v9.5 — rate limiting.
CREATE TABLE IF NOT EXISTS "RateLimit" (
  "id" TEXT NOT NULL,
  "bucket" TEXT NOT NULL,
  "windowStart" TIMESTAMP(3) NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 1,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "RateLimit_bucket_windowStart_key" ON "RateLimit"("bucket","windowStart");
CREATE INDEX IF NOT EXISTS "RateLimit_windowStart_idx" ON "RateLimit"("windowStart");
